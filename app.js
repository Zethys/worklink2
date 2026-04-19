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
    const targetPage = document.getElementById(id);
    if (targetPage) targetPage.classList.add('active');
    window.scrollTo(0,0);
};

window.auth = async (type) => {
    const p = document.getElementById(type+'Phone').value;
    const s = document.getElementById(type+'Pass').value;
    if(type === 'reg') {
        const r = document.getElementById('regRole').value;
        await set(ref(db, 'users/'+p), { phone: p, pass: s, role: r, balance: 0 });
        toast("Успех! Теперь войдите."); showPage('login');
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
    const currentBalance = sn.val().balance || 0;
    await update(ref(db, `users/${phone}`), { balance: currentBalance + amount });
};

window.addMoney = async () => {
    const amount = prompt("Введите сумму пополнения (₸):");
    if (amount && !isNaN(amount) && Number(amount) > 0) {
        await window.updateBalance(user.phone, Number(amount));
        toast(`Счет пополнен на ${amount} ₸`);
    }
};

window.initSession = () => {
    if(!user) return;
    document.getElementById('guestNav').style.display = 'none';
    document.getElementById('userNav').style.display = 'flex';
    
    onValue(ref(db, `users/${user.phone}`), (sn) => {
        const userData = sn.val();
        if(document.getElementById('wBalance')) document.getElementById('wBalance').innerText = userData.balance || 0;
        if(document.getElementById('bBalance')) document.getElementById('bBalance').innerText = userData.balance || 0;
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
    if(sn.val().balance < price) return toast("Недостаточно средств на балансе!");

    await push(ref(db, 'orders'), {
        title: title, price: price, city: document.getElementById('oCity').value,
        status: 'open', owner: user.phone, time: Date.now()
    });
    await window.updateBalance(user.phone, -price);
    toast("Создано!"); showPage('business_panel');
};

window.renderBiz = (sn) => {
    const list = document.getElementById('biz_list'); 
    if(!list) return;
    list.innerHTML = "";
    const data = sn.val();
    for(let id in data) {
        if(data[id].owner === user.phone) {
            const stars = data[id].rating ? '★'.repeat(data[id].rating) + '☆'.repeat(5-data[id].rating) : '';
            const el = document.createElement('div'); el.className = 'order-card';
            el.innerHTML = `
                <span class="status-badge status-${data[id].status}">${data[id].status}</span>
                <h3>${data[id].title}</h3><p>${data[id].price} ₸</p>
                <div class="stars" style="color:#fdcb6e">${stars}</div>
                ${data[id].status === 'completed' && !data[id].rating ? `<button class="btn-action btn-purple" style="margin-top:10px" onclick="window.openRating('${id}')">⭐ Оценить</button>` : ''}`;
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

window.finish = async (id) => {
    const order = window.ordersData[id];
    await update(ref(db, `orders/${id}`), { status: 'completed' });
    await window.updateBalance(user.phone, order.price);
    toast(`Выполнено! +${order.price} ₸`);
};

window.openRating = (id) => {
    currentOrderForRate = id;
    selectedRating = 0;
    document.querySelectorAll('.star-btn').forEach(s => s.classList.remove('active'));
    document.getElementById('ratingModal').style.display = 'flex';
};

window.setRating = (val) => {
    selectedRating = val;
    document.querySelectorAll('.star-btn').forEach((s, i) => {
        i < val ? s.classList.add('active') : s.classList.remove('active');
    });
};

window.submitRating = async () => {
    if(selectedRating === 0) return toast("Выберите оценку!");
    await update(ref(db, `orders/${currentOrderForRate}`), { rating: selectedRating });
    document.getElementById('ratingModal').style.display = 'none';
    toast("Спасибо за оценку!");
};

window.submitPartner = () => { push(ref(db, 'partners'), { fio: document.getElementById('biz_fio').value }); toast("Отправлено!"); };
window.logout = () => { localStorage.clear(); location.reload(); };

if(user) window.initSession();
