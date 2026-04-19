import { db } from './firebase-config.js';
import { ref, push, set, get, child, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let user = JSON.parse(localStorage.getItem('wl_session')) || null;

window.toast = (txt) => {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast'; t.innerText = txt;
    c.appendChild(t); setTimeout(() => t.remove(), 3000);
};

window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(id);
    if (targetPage) targetPage.classList.add('active');
    window.scrollTo(0,0);
};

window.auth = async (type) => {
    const p = document.getElementById(type+'Phone').value;
    const s = document.getElementById(type+'Pass').value;
    if(type === 'reg') {
        const r = document.getElementById('regRole').value;
        await set(ref(db, 'users/'+p), { phone: p, pass: s, role: r });
        toast("Успех! Теперь войдите."); showPage('login');
    } else {
        const sn = await get(child(ref(db), `users/${p}`));
        if(sn.exists() && sn.val().pass === s) {
            user = sn.val(); localStorage.setItem('wl_session', JSON.stringify(user));
            window.initSession();
        } else toast("Ошибка!");
    }
};

window.initSession = () => {
    if(!user) return;
    document.getElementById('guestNav').style.display = 'none';
    document.getElementById('userNav').style.display = 'flex';
    const btn = document.getElementById('panelBtn');
    if(user.role === 'business') {
        btn.onclick = () => showPage('business_panel');
        onValue(ref(db, 'orders'), window.renderBiz);
        showPage('business_panel');
    } else {
        btn.onclick = () => showPage('worker_panel');
        onValue(ref(db, 'orders'), (sn) => { window.ordersData = sn.val(); window.renderWorker(); window.renderMy(); });
        showPage('worker_panel');
    }
};

window.postOrder = async () => {
    await push(ref(db, 'orders'), {
        title: document.getElementById('oTitle').value,
        price: Number(document.getElementById('oPrice').value),
        city: document.getElementById('oCity').value,
        status: 'open', owner: user.phone, time: Date.now()
    });
    toast("Создано!"); showPage('business_panel');
};

window.renderBiz = (sn) => {
    const list = document.getElementById('biz_list'); 
    if(!list) return;
    list.innerHTML = "";
    const data = sn.val();
    for(let id in data) {
        if(data[id].owner === user.phone) {
            const el = document.createElement('div'); el.className = 'order-card';
            el.innerHTML = `<span class="status-badge status-${data[id].status}">${data[id].status}</span>
            <h3>${data[id].title}</h3><p>${data[id].price} ₸</p>
            ${data[id].status === 'completed' && !data[id].rating ? `<button onclick="window.rate('${id}')">⭐ Оценить</button>` : ''}`;
            list.appendChild(el);
        }
    }
};

window.renderWorker = () => {
    const list = document.getElementById('worker_list'); 
    if(!list) return;
    list.innerHTML = "";
    const q = document.getElementById('sTitle').value.toLowerCase();
    const c = document.getElementById('sCity').value.toLowerCase();
    let items = Object.keys(window.ordersData || {}).map(id => ({id, ...window.ordersData[id]}))
        .filter(i => i.status === 'open' && i.title.toLowerCase().includes(q) && i.city.toLowerCase().includes(c));
    
    if(document.getElementById('sPrice').value === 'exp') items.sort((a,b) => b.price - a.price);
    
    items.forEach(i => {
        const el = document.createElement('div'); el.className = 'order-card';
        el.innerHTML = `<h3>${i.title}</h3><p style="color:var(--primary-purple); font-weight:800">${i.price} ₸</p><p>📍 ${i.city}</p>
        <button class="btn-action btn-success" style="margin-top:15px" onclick="window.take('${i.id}')">Принять</button>`;
        list.appendChild(el);
    });
};

window.renderMy = () => {
    const list = document.getElementById('my_list'); 
    if(!list) return;
    list.innerHTML = "";
    const d = window.ordersData;
    for(let id in d) {
        if(d[id].worker === user.phone && d[id].status === 'taken') {
            const el = document.createElement('div'); el.className = 'order-card';
            el.innerHTML = `<h3>${d[id].title}</h3><p>${d[id].price} ₸</p>
            <button class="btn-action btn-purple" onclick="window.finish('${id}')">Завершить</button>`;
            list.appendChild(el);
        }
    }
};

window.take = (id) => update(ref(db, `orders/${id}`), { status: 'taken', worker: user.phone });
window.finish = (id) => update(ref(db, `orders/${id}`), { status: 'completed' });
window.rate = (id) => { const r = prompt("Оценка 1-5:"); if(r) update(ref(db, `orders/${id}`), { rating: r }); };
window.submitPartner = () => { push(ref(db, 'partners'), { fio: document.getElementById('biz_fio').value }); toast("Отправлено!"); };
window.logout = () => { localStorage.clear(); location.reload(); };

// Запуск сессии при загрузке
if(user) window.initSession();
