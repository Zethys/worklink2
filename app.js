import { db } from './firebase-config.js';
import { ref, push, set, get, child, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let user = JSON.parse(localStorage.getItem('wl_session')) || null;
let currentOrderForRate = null;
let selectedRating = 0;

window.toast = (txt) => {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast'; t.innerText = txt;
    c.appendChild(t); setTimeout(() => t.remove(), 3000);
};

window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    window.scrollTo(0,0);
};

window.auth = async (type) => {
    const p = document.getElementById(type+'Phone').value;
    const s = document.getElementById(type+'Pass').value;
    if(type === 'reg') {
        const r = document.getElementById('regRole').value;
        await set(ref(db, 'users/'+p), { phone: p, pass: s, role: r, balance: 0 });
        toast("Успех!"); showPage('login');
    } else {
        const sn = await get(child(ref(db), `users/${p}`));
        if(sn.exists() && sn.val().pass === s) {
            user = sn.val(); localStorage.setItem('wl_session', JSON.stringify(user));
            window.initSession();
        } else toast("Ошибка!");
    }
};

window.updateBalance = async (phone, amount) => {
    const sn = await get(child(ref(db), `users/${phone}`));
    const current = sn.val().balance || 0;
    await update(ref(db, `users/${phone}`), { balance: current + amount });
};

window.addMoney = async () => {
    const amount = prompt("Сумма пополнения:");
    if (amount > 0) { await window.updateBalance(user.phone, Number(amount)); toast("Пополнено!"); }
};

window.initSession = () => {
    if(!user) return;
    document.getElementById('guestNav').style.display = 'none';
    document.getElementById('userNav').style.display = 'flex';
    onValue(ref(db, `users/${user.phone}`), (sn) => {
        const d = sn.val();
        if(document.getElementById('wBalance')) document.getElementById('wBalance').innerText = d.balance || 0;
        if(document.getElementById('bBalance')) document.getElementById('bBalance').innerText = d.balance || 0;
    });
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
    const title = document.getElementById('oTitle').value;
    const price = Number(document.getElementById('oPrice').value);
    const sn = await get(child(ref(db), `users/${user.phone}`));
    if(sn.val().balance < price) return toast("Мало денег!");
    await push(ref(db, 'orders'), { title, price, city: document.getElementById('oCity').value, status: 'open', owner: user.phone, time: Date.now() });
    await window.updateBalance(user.phone, -price);
    toast("Создано!"); showPage('business_panel');
};

window.renderBiz = (sn) => {
    const list = document.getElementById('biz_list'); 
    if(!list) return; list.innerHTML = "";
    const data = sn.val();
    for(let id in data) {
        if(data[id].owner === user.phone) {
            const stars = data[id].rating ? '★'.repeat(data[id].rating) : '';
            const el = document.createElement('div'); el.className = 'order-card';
            el.innerHTML = `<h3>${data[id].title}</h3><p>${data[id].price} ₸</p><div style="color:#fdcb6e">${stars}</div>
            ${data[id].status === 'completed' && !data[id].rating ? `<button class="btn-action btn-purple" onclick="window.openRating('${id}')">⭐ Оценить</button>` : ''}`;
            list.appendChild(el);
        }
    }
};

window.renderWorker = () => {
    const list = document.getElementById('worker_list'); 
    if(!list) return; list.innerHTML = "";
    const items = Object.keys(window.ordersData || {}).map(id => ({id, ...window.ordersData[id]})).filter(i => i.status === 'open');
    items.forEach(i => {
        const el = document.createElement('div'); el.className = 'order-card';
        el.innerHTML = `<h3>${i.title}</h3><p>${i.price} ₸</p><button class="btn-action btn-success" onclick="window.take('${i.id}')">Принять</button>`;
        list.appendChild(el);
    });
};

window.renderMy = () => {
    const list = document.getElementById('my_list'); 
    if(!list) return; list.innerHTML = "";
    for(let id in window.ordersData) {
        if(window.ordersData[id].worker === user.phone && window.ordersData[id].status === 'taken') {
            const el = document.createElement('div'); el.className = 'order-card';
            el.innerHTML = `<h3>${window.ordersData[id].title}</h3><button class="btn-action btn-purple" onclick="window.finish('${id}')">Завершить</button>`;
            list.appendChild(el);
        }
    }
};

window.take = (id) => update(ref(db, `orders/${id}`), { status: 'taken', worker: user.phone });
window.finish = async (id) => {
    const order = window.ordersData[id];
    await update(ref(db, `orders/${id}`), { status: 'completed' });
    await window.updateBalance(user.phone, order.price);
    toast("Выполнено!");
};

window.openRating = (id) => { currentOrderForRate = id; document.getElementById('ratingModal').style.display = 'flex'; };
window.setRating = (val) => { selectedRating = val; document.querySelectorAll('.star-btn').forEach((s, i) => s.style.color = i < val ? '#fdcb6e' : '#ddd'); };
window.submitRating = async () => {
    await update(ref(db, `orders/${currentOrderForRate}`), { rating: selectedRating });
    document.getElementById('ratingModal').style.display = 'none';
};

window.logout = () => { localStorage.clear(); location.reload(); };
window.submitPartner = () => { toast("Заявка отправлена!"); };

if(user) window.initSession();
