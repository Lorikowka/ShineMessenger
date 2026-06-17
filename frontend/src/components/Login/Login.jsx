import React, { useState } from 'react';
import './Login.css';

const CATEGORIES = ['R', 'I', 'P', 'E', 'A'];
const TRUST_LEVELS = ['L', 'M', 'H', 'A', 'S', 'SS', 'SSS'];
const ALGORITHMS = ['C', 'S', 'X', 'D'];

const Login = ({ onLogin }) => {
    const [citizenId, setCitizenId] = useState('');
    const [password, setPassword] = useState('');
    const [category, setCategory] = useState('R');
    const [erasureCount, setErasureCount] = useState(0);
    const [trust, setTrust] = useState('L');
    const [algo, setAlgo] = useState('C');
    const [error, setError] = useState('');

    const generateId = () => {
        const randomNum = Math.floor(10 + Math.random() * 90);
        const fullNumber = `${randomNum}${erasureCount}`;
        return `${category}-${fullNumber}${trust}${algo}`;
    };

    const handleAutoGenerate = () => {
        setCitizenId(generateId());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!citizenId || !password) {
            setError('ВВЕДИТЕ ID И ПАРОЛЬ');
            return;
        }

        try {
            const apiUrl = 'https://shinemessenger-production.up.railway.app';
            console.log('[DEBUG] Попытка авторизации. URL API:', apiUrl);
            const response = await fetch(`${apiUrl}/api/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ citizenId, password })
            });

            const data = await response.json();
            if (response.ok) {
                onLogin(data.citizenId, data.token);
            } else {
                setError(data.error || 'ОШИБКА ДОСТУПА');
            }
        } catch (err) {
            setError('СЕРВЕР НЕДОСТУПЕН');
        }
    };

    return (
        <div className="raya-modal-overlay">
            <div className="raya-window login-window">
                <div className="raya-scanlines"></div>
                <div className="raya-window-inner">
                    <header className="raya-header">
                        <div className="raya-info">
                            <div className="raya-label">АВТОРИЗАЦИЯ В СИСТЕМЕ</div>
                        </div>
                    </header>

                    <form className="raya-body login-form" onSubmit={handleSubmit}>
                        <div className="login-field">
                            <label>ID ГРАЖДАНИНА:</label>
                            <input type="text" value={citizenId} onChange={(e) => setCitizenId(e.target.value)} placeholder="A-000XXX" />
                        </div>
                        
                        <div className="login-field">
                            <label>ПАРОЛЬ:</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="******" />
                        </div>

                        <div className="id-generator-section">
                            <div className="login-field">
                                <label>КАТЕГОРИЯ:</label>
                                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <button type="button" className="raya-btn-mini" onClick={handleAutoGenerate}>СГЕНЕРИРОВАТЬ ID</button>
                        </div>

                        {error && <div className="raya-system-error">{error}</div>}

                        <div className="login-actions">
                            <button type="submit" className="raya-btn primary">ВОЙТИ / РЕГИСТРАЦИЯ</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
