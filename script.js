import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDi5gsOdE9tGOR6JQzMgw_9QscD-XBRNwk",
    authDomain: "alook-26a1f.firebaseapp.com",
    projectId: "alook-26a1f",
    storageBucket: "alook-26a1f.appspot.com",
    messagingSenderId: "201575321450",
    appId: "1:201575321450:web:3f00cdd591af0d5e52df13"
};
const APP_ID = 'nsg-poly-asset-manager';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Local State
let assets = [];
let departments = [];
let inkRequests = [];
let currentLogs = []; // Temporary logs for Modal
let userRole = 'viewer';
let currentUser = null;
let currentEditDeptIndex = -1;

// Auth Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        initDataSync();
    } else {
        signInAnonymously(auth);
    }
});

// Real-time Data Sync
function initDataSync() {
    // Departments
    onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'departments', 'list'), (snap) => {
        departments = snap.exists() ? snap.data().list : ["Khoa CNTT", "Phòng Đào Tạo", "Ban Giám Hiệu"];
        updateSelects();
        renderDeptList();
    });

    // Assets
    onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'assets'), (snap) => {
        assets = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
        assets.sort((a, b) => (b.id || 0) - (a.id || 0));
        renderTable();
        renderDashboard();
        handleDeepLinking();
    });

    // Ink Requests
    onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'ink_requests'), (snap) => {
        inkRequests = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
        renderInkTable();
        renderInkStats();
    });
}

// --- MAINTENANCE LOGS FUNCTIONS ---
window.addMaintenanceLog = () => {
    const text = document.getElementById('input-log-text').value.trim();
    if (!text) return;
    const log = {
        date: new Date().toLocaleDateString('vi-VN'),
        text: text
    };
    currentLogs.unshift(log); // Add to beginning
    document.getElementById('input-log-text').value = '';
    renderModalLogs();
};

window.removeLog = (index) => {
    currentLogs.splice(index, 1);
    renderModalLogs();
};

function renderModalLogs() {
    const list = document.getElementById('modal-logs-list');
    list.innerHTML = currentLogs.map((log, i) => `
        <div class="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm mb-1">
            <div class="text-[10px] font-bold text-slate-700">
                <span class="text-indigo-500 mr-2">${log.date}</span> ${log.text}
            </div>
            <button type="button" onclick="removeLog(${i})" class="text-rose-400 hover:text-rose-600 px-2"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `).join('');
    if (!currentLogs.length) list.innerHTML = '<p class="text-[10px] text-slate-400 italic text-center py-4">Chưa có nhật ký bảo trì</p>';
}

// --- ASSET LOGIC ---
window.saveAsset = async () => {
    if (userRole !== 'admin') return;
    const f = document.getElementById('asset-form');
    if (!f.checkValidity()) return f.reportValidity();
    
    const fid = document.getElementById('asset-firestore-id').value;
    const type = document.getElementById('input-type').value;
    
    const specs = (type === 'PC' || type === 'Laptop') ? {
        Mainboard: document.getElementById('spec-mainboard').value,
        CPU: document.getElementById('spec-cpu').value,
        RAM: document.getElementById('spec-ram').value,
        Disk: document.getElementById('spec-disk').value,
        Monitor: document.getElementById('spec-monitor').value,
        PSU: document.getElementById('spec-psu').value
    } : {
        Model: document.getElementById('spec-generic-model').value,
        Detail: document.getElementById('spec-generic-detail').value
    };

    const data = {
        id: document.getElementById('asset-id').value || Date.now(),
        code: document.getElementById('input-code').value,
        name: document.getElementById('input-name').value,
        type: type,
        dept: document.getElementById('input-dept').value,
        user: document.getElementById('input-user').value,
        position: document.getElementById('input-position').value,
        status: document.getElementById('input-status').value,
        date: document.getElementById('input-date').value,
        specs: specs,
        history: currentLogs
    };

    try {
        if (fid) await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'assets', fid), data);
        else await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'assets'), data);
        showToast("Đã lưu tài sản thành công");
        closeModal();
    } catch (err) { showToast("Lỗi khi lưu dữ liệu"); }
};

window.deleteAsset = async (fid) => {
    if (userRole !== 'admin') return;
    if (!confirm("Bạn có chắc chắn muốn xóa tài sản này? Dữ liệu không thể khôi phục.")) return;
    try {
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'assets', fid));
        showToast("Đã xóa tài sản khỏi hệ thống");
    } catch (err) { showToast("Lỗi khi xóa dữ liệu"); }
};

window.editAsset = (id) => {
    const a = assets.find(x => x.id == id);
    if (!a) return;
    openModal(true);
    document.getElementById('asset-firestore-id').value = a.firestoreId;
    document.getElementById('asset-id').value = a.id;
    document.getElementById('input-code').value = a.code;
    document.getElementById('input-name').value = a.name;
    document.getElementById('input-type').value = a.type;
    document.getElementById('input-dept').value = a.dept;
    document.getElementById('input-user').value = a.user || '';
    document.getElementById('input-position').value = a.position || '';
    document.getElementById('input-status').value = a.status;
    document.getElementById('input-date').value = a.date || '';
    
    currentLogs = a.history || [];
    renderModalLogs();
    
    toggleSpecFields();
    if (a.specs) {
        if (a.type === 'PC' || a.type === 'Laptop') {
            document.getElementById('spec-mainboard').value = a.specs.Mainboard || '';
            document.getElementById('spec-cpu').value = a.specs.CPU || '';
            document.getElementById('spec-ram').value = a.specs.RAM || '';
            document.getElementById('spec-disk').value = a.specs.Disk || '';
            document.getElementById('spec-monitor').value = a.specs.Monitor || '';
            document.getElementById('spec-psu').value = a.specs.PSU || '';
        } else {
            document.getElementById('spec-generic-model').value = a.specs.Model || '';
            document.getElementById('spec-generic-detail').value = a.specs.Detail || '';
        }
    }
    document.getElementById('modal-qr-section').classList.remove('hidden');
    generateQR('modal-qr-code', a.id);
};

window.showAssetDetail = (asset) => {
    document.getElementById('view-asset-code').innerText = asset.code;
    document.getElementById('view-asset-name').innerText = asset.name;
    document.getElementById('view-asset-type').innerText = getAssetTypeLabel(asset.type);
    document.getElementById('view-asset-dept').innerText = asset.dept;
    document.getElementById('view-asset-user').innerText = asset.user || 'N/A';
    document.getElementById('view-asset-position').innerText = asset.position || 'N/A';

    // Banner Disposal
    const banner = document.getElementById('disposal-banner');
    if (asset.status === 'Disposal') banner.classList.remove('hidden');
    else banner.classList.add('hidden');

    const stIcon = document.getElementById('view-status-icon');
    if (asset.status === 'Active') {
        stIcon.className = "mx-auto w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6 bg-emerald-100 text-emerald-600";
        stIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
    } else if (asset.status === 'Repair') {
        stIcon.className = "mx-auto w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6 bg-amber-100 text-amber-600";
        stIcon.innerHTML = '<i class="fa-solid fa-screwdriver-wrench"></i>';
    } else if (asset.status === 'Disposal') {
        stIcon.className = "mx-auto w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6 bg-rose-100 text-rose-600";
        stIcon.innerHTML = '<i class="fa-solid fa-dumpster"></i>';
    } else {
        stIcon.className = "mx-auto w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6 bg-slate-100 text-slate-400";
        stIcon.innerHTML = '<i class="fa-solid fa-warehouse"></i>';
    }

    // Maintenance History for Viewer
    const historyList = document.getElementById('view-history-list');
    if (asset.history && asset.history.length) {
        historyList.innerHTML = asset.history.map(log => `
            <div class="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-xs">
                <span class="font-black text-indigo-500 mr-2">${log.date}</span>
                <span class="text-slate-600 font-medium">${log.text}</span>
            </div>
        `).join('');
    } else {
        historyList.innerHTML = '<p class="text-[10px] text-slate-400 italic">Chưa có thông tin bảo trì</p>';
    }

    // Technical Specs
    const specList = document.getElementById('view-specs-list');
    specList.innerHTML = '';
    if (asset.specs) {
        Object.entries(asset.specs).forEach(([k, v]) => {
            if (v) {
                specList.innerHTML += `<div class="p-3 bg-slate-50 rounded-xl flex justify-between"><span class="text-[10px] font-black text-slate-400 uppercase">${k}</span><span class="font-bold text-slate-700 text-sm">${v}</span></div>`;
            }
        });
    }
    document.getElementById('detail-modal').classList.remove('hidden');
    document.getElementById('detail-modal').classList.add('flex');
    document.body.classList.add('modal-open');
};

// --- INK LOGIC ---
window.saveInkRequest = async () => {
    if (userRole !== 'admin') return;
    const f = document.getElementById('ink-form');
    if (!f.checkValidity()) return f.reportValidity();
    const data = {
        datePropose: document.getElementById('ink-date-propose').value,
        dateFill: document.getElementById('ink-date-fill').value || '',
        dept: document.getElementById('ink-dept').value,
        user: document.getElementById('ink-user').value,
        model: document.getElementById('ink-model').value,
        type: document.getElementById('ink-type-input').value,
        status: document.getElementById('ink-date-fill').value ? 'Completed' : 'Pending'
    };
    try {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'ink_requests'), data);
        showToast("Đã ghi nhận yêu cầu nạp mực");
        f.reset();
    } catch (err) { showToast("Lỗi hệ thống"); }
};

window.deleteInkRequest = async (fid) => {
    if (userRole !== 'admin') return;
    if (!confirm("Xóa yêu cầu nạp mực này?")) return;
    try {
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'ink_requests', fid));
        showToast("Đã xóa yêu cầu");
    } catch (err) { showToast("Lỗi khi xóa"); }
};

// --- UI RENDERERS ---
window.renderTable = () => {
    const tbody = document.getElementById('asset-table-body');
    if (!tbody) return;
    const search = document.getElementById('search-input').value.toLowerCase();
    const fDept = document.getElementById('filter-dept').value;
    const fStatus = document.getElementById('filter-status').value;
    
    tbody.innerHTML = '';
    const filtered = assets.filter(a => {
        const s = (a.name + a.code + (a.user || '') + (a.position || '')).toLowerCase();
        return s.includes(search) && (!fDept || a.dept === fDept) && (!fStatus || a.status === fStatus);
    });

    if (filtered.length === 0) {
        document.getElementById('no-data').classList.remove('hidden');
        return;
    }
    document.getElementById('no-data').classList.add('hidden');

    filtered.forEach(a => {
        const stCls = a.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : (a.status === 'Repair' ? 'bg-amber-50 text-amber-600' : (a.status === 'Disposal' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'));
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition border-b border-slate-50">
                <td class="px-8 py-5">
                    <div class="text-[10px] font-black text-blue-500 font-mono mb-1 uppercase tracking-widest">${a.code}</div>
                    <div class="font-black text-slate-800 tracking-tight text-base cursor-pointer" onclick='showAssetDetail(${JSON.stringify(a).replace(/'/g, "&apos;")})'>${a.name}</div>
                </td>
                <td class="px-8 py-5">
                    <div class="font-bold text-slate-700">${a.user || '-'}</div>
                    <div class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">${a.position || '-'}</div>
                </td>
                <td class="px-8 py-5">
                    <div class="text-xs font-black text-slate-600">${getAssetTypeLabel(a.type)}</div>
                    <div class="text-[10px] font-bold text-slate-400 mt-1 uppercase italic">${a.dept}</div>
                </td>
                <td class="px-8 py-5 text-center">
                    <button onclick='showAssetDetail(${JSON.stringify(a).replace(/'/g, "&apos;")})' class="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-blue-600 transition border border-slate-100"><i class="fa-solid fa-qrcode"></i></button>
                </td>
                <td class="px-8 py-5">
                    <span class="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${stCls}">${a.status === 'Disposal' ? 'Đã Thanh Lý' : a.status}</span>
                </td>
                <td class="px-8 py-5 text-right admin-only-cell ${userRole !== 'admin' ? 'hidden' : ''}">
                    <div class="flex justify-end gap-2">
                        <button onclick="editAsset('${a.id}')" class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600"><i class="fa-solid fa-pen text-[10px]"></i></button>
                        <button onclick="deleteAsset('${a.firestoreId}')" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-500"><i class="fa-solid fa-trash text-[10px]"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
};

function renderInkTable() {
    const tbody = document.getElementById('ink-table-body');
    if (!tbody) return;
    tbody.innerHTML = inkRequests.map(r => `
        <tr class="border-b border-slate-50">
            <td class="px-6 py-4 font-bold text-slate-800">${r.datePropose}</td>
            <td class="px-6 py-4">
                <div class="font-black text-slate-700 text-left">${r.dept}</div>
                <div class="text-[10px] text-slate-400 uppercase tracking-tight text-left">${r.user}</div>
            </td>
            <td class="px-6 py-4 text-left">
                <div class="font-bold text-blue-600 uppercase">${r.model}</div>
                <div class="text-[10px] font-bold text-slate-400 uppercase">Loại: ${r.type}</div>
            </td>
            <td class="px-6 py-4 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${r.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}">${r.status === 'Completed' ? 'Đã nạp' : 'Chờ nạp'}</span>
            </td>
            <td class="px-6 py-4 text-right admin-only-cell">
                <button onclick="deleteInkRequest('${r.firestoreId}')" class="text-rose-400 hover:text-rose-600"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// --- AUTH & NAVIGATION ---
window.handleLogin = () => {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;
    if (user === 'admin' && pass === 'Nsg@2026') {
        proceedAs('admin');
        hideLogin();
        showToast("Đã đăng nhập quyền Admin");
    } else {
        const err = document.getElementById('login-error');
        err.innerText = "Sai thông tin đăng nhập!";
        err.classList.remove('hidden');
    }
};

function proceedAs(role) {
    userRole = role;
    localStorage.setItem('nsg_role', role);
    document.body.classList.toggle('is-admin', role === 'admin');
    document.getElementById('user-name').innerText = role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'KHÁCH TRUY CẬP';
    document.getElementById('user-role').innerText = role.toUpperCase();
    document.getElementById('btn-login-trigger').classList.toggle('hidden', role === 'admin');
    document.getElementById('btn-logout').classList.toggle('hidden', role !== 'admin');
    renderTable();
    renderDeptList();
    renderInkTable();
}

window.handleLogout = () => { proceedAs('viewer'); showToast("Đã đăng xuất"); };

// --- DEPT LOGIC ---
window.saveDept = async () => {
    const name = document.getElementById('input-dept-name').value.trim();
    if (!name) return;
    let newList = [...departments];
    if (currentEditDeptIndex > -1) newList[currentEditDeptIndex] = name;
    else newList.push(name);
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'departments', 'list'), { list: newList });
    closeDeptModal();
    showToast("Đã cập nhật danh sách đơn vị");
};

window.deleteDept = async (idx) => {
    if (!confirm("Xóa đơn vị này?")) return;
    const newList = departments.filter((_, i) => i !== idx);
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'departments', 'list'), { list: newList });
};

// --- UI UTILS ---
window.showLogin = () => document.getElementById('login-screen').classList.add('modal-active');
window.hideLogin = () => document.getElementById('login-screen').classList.remove('modal-active');
window.openModal = (isEdit = false) => {
    document.getElementById('asset-modal').classList.remove('hidden');
    document.getElementById('asset-modal').classList.add('flex');
    if (!isEdit) {
        document.getElementById('asset-form').reset();
        document.getElementById('asset-firestore-id').value = '';
        document.getElementById('asset-id').value = '';
        document.getElementById('input-code').value = 'AS-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        document.getElementById('modal-qr-section').classList.add('hidden');
        document.getElementById('input-date').valueAsDate = new Date();
        currentLogs = [];
        renderModalLogs();
        toggleSpecFields();
    }
};
window.closeModal = () => document.getElementById('asset-modal').classList.add('hidden');
window.closeDetailModal = () => { 
    document.getElementById('detail-modal').classList.add('hidden'); 
    document.body.classList.remove('modal-open');
};
window.openDeptModal = (idx = -1) => {
    currentEditDeptIndex = idx;
    document.getElementById('input-dept-name').value = idx > -1 ? departments[idx] : '';
    document.getElementById('dept-modal').classList.remove('hidden');
    document.getElementById('dept-modal').classList.add('flex');
};
window.closeDeptModal = () => document.getElementById('dept-modal').classList.add('hidden');

window.switchTab = (tab) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${tab}`).classList.add('active');
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('sidebar-item-active'));
    document.getElementById(`nav-${tab}`).classList.add('sidebar-item-active');
    document.getElementById('page-title').innerText = document.getElementById(`nav-${tab}`).innerText;
    if (window.innerWidth < 768) toggleMobileSidebar();
};

window.toggleMobileSidebar = () => document.getElementById('sidebar').classList.toggle('-translate-x-full');

window.toggleSpecFields = () => {
    const t = document.getElementById('input-type').value;
    const isPC = t === 'PC' || t === 'Laptop';
    document.getElementById('specs-container').classList.toggle('hidden', !isPC);
    document.getElementById('generic-specs-container').classList.toggle('hidden', isPC);
};

function getAssetTypeLabel(t) {
    const map = { PC: 'Máy tính bộ', Laptop: 'Laptop', Printer: 'Máy in', Scanner: 'Máy scan', AirConditioner: 'Máy lạnh', Projector: 'Máy chiếu', Other: 'Khác' };
    return map[t] || t;
}

window.showToast = (m) => {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = m;
    t.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000);
};

window.generateQR = (elId, id) => {
    const el = document.getElementById(elId); el.innerHTML = '';
    const url = window.location.href.split('?')[0] + '?assetId=' + id;
    new QRCode(el, { text: url, width: 128, height: 128 });
};

window.downloadModalQR = () => {
    const canvas = document.querySelector('#modal-qr-code canvas');
    if (canvas) {
        const a = document.createElement('a');
        a.download = `QR_${document.getElementById('input-code').value}.png`;
        a.href = canvas.toDataURL();
        a.click();
    }
};

function handleDeepLinking() {
    const params = new URLSearchParams(window.location.search);
    const assetId = params.get('assetId');
    if (assetId) {
        const a = assets.find(x => x.id == assetId);
        if (a) {
            showAssetDetail(a);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

function renderDashboard() {
    const stats = { Active: 0, Repair: 0, Spare: 0, Disposal: 0 };
    const typeData = {};
    const deptData = {};
    assets.forEach(a => {
        if (stats[a.status] !== undefined) stats[a.status]++;
        const t = getAssetTypeLabel(a.type);
        typeData[t] = (typeData[t] || 0) + 1;
        deptData[a.dept] = (deptData[a.dept] || 0) + 1;
    });
    document.getElementById('stat-total').innerText = assets.length;
    document.getElementById('stat-active').innerText = stats.Active;
    document.getElementById('stat-repair').innerText = stats.Repair;
    document.getElementById('stat-disposal').innerText = stats.Disposal;
    renderBars('type-distribution', typeData);
    renderBars('dept-distribution', deptData);
}

function renderBars(cid, data) {
    const container = document.getElementById(cid); container.innerHTML = '';
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    if (total === 0) return;
    Object.entries(data).forEach(([k, v]) => {
        const p = Math.round((v / total) * 100);
        container.innerHTML += `
            <div class="space-y-1">
                <div class="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>${k}</span><span>${v} (${p}%)</span></div>
                <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-blue-600" style="width:${p}%"></div></div>
            </div>`;
    });
}

function updateSelects() {
    const opts = departments.map(d => `<option value="${d}">${d}</option>`).join('');
    const fDept = document.getElementById('filter-dept');
    if (fDept) fDept.innerHTML = '<option value="">Tất cả đơn vị</option>' + opts;
    const iDept = document.getElementById('input-dept');
    if (iDept) iDept.innerHTML = opts;
    const kDept = document.getElementById('ink-dept');
    if (kDept) kDept.innerHTML = opts;
}

function renderDeptList() {
    const tbody = document.getElementById('dept-table-body');
    if (!tbody) return;
    tbody.innerHTML = departments.map((d, i) => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-50">
            <td class="px-8 py-5 text-xs font-mono text-slate-300">#${i + 1}</td>
            <td class="px-8 py-5 font-black text-slate-700 text-left">${d}</td>
            <td class="px-8 py-5 text-right admin-only-cell">
                <button onclick="openDeptModal(${i})" class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 mr-2"><i class="fa-solid fa-pen text-[10px]"></i></button>
                <button onclick="deleteDept(${i})" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-500"><i class="fa-solid fa-trash text-[10px]"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderInkStats() {
    document.getElementById('ink-stat-total').innerText = inkRequests.length;
    document.getElementById('ink-stat-pending').innerText = inkRequests.filter(r => r.status === 'Pending').length;
    document.getElementById('ink-stat-done').innerText = inkRequests.filter(r => r.status === 'Completed').length;
}

window.filterAssets = () => renderTable();

// Initialize on Load
window.onload = () => {
    const savedRole = localStorage.getItem('nsg_role') || 'viewer';
    proceedAs(savedRole);
    document.getElementById('ink-date-propose').valueAsDate = new Date();
};