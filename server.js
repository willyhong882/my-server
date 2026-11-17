const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // ⭐ sqlite3 대신 pg 사용
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// 1. 클라우드 데이터베이스(PostgreSQL) 연결
// ==========================================
// ⚠️ Render에서 복사한 Internal Database URL을 아래에 붙여넣으세요!
// (로컬 테스트 시에는 본인의 로컬 DB 주소를 넣거나, 일단 Render 주소를 넣어도 됩니다.)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://my_db_ee3a_user:kgqvKEXW186z8evRED38P8TEWv4r4hWZ@dpg-dbueh6tg1s2s73bk6a70-a/my_db_ee3a',
    ssl: { rejectUnauthorized: false } // Render 클라우드 DB 보안 연결
});

// 테이블 생성 (PostgreSQL 문법)
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE,
                password TEXT
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS todos (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50),
                text TEXT,
                done BOOLEAN DEFAULT false
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                content TEXT,
                sender VARCHAR(50)
            );
        `);
        console.log('✅ 클라우드 DB 테이블 준비 완료');
    } catch (err) {
        console.error('DB 초기화 에러:', err);
    }
};
initDB();

// ==========================================
// 2. API 라우팅 (PostgreSQL 쿼리 적용)
// ==========================================

// [회원가입]
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
            [username, hashedPassword]
        );
        res.json({ message: '회원가입 성공! 이제 로그인하세요.', id: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: '이미 존재하는 아이디입니다.' }); // UNIQUE 위반
        res.status(500).json({ error: err.message });
    }
});

// [로그인]
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        
        if (!user) return res.status(400).json({ error: '아이디 또는 비밀번호가 틀렸습니다.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: '아이디 또는 비밀번호가 틀렸습니다.' });

        const token = jwt.sign({ userId: user.id, username: user.username }, 'my_secret_key_123', { expiresIn: '1h' });
        res.json({ message: '로그인 성공!', token: token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [To-Do 불러오기]
app.get('/api/todos', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: '사용자 정보가 없습니다.' });

    try {
        const result = await pool.query('SELECT * FROM todos WHERE username = $1 ORDER BY id DESC', [username]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [To-Do 추가]
app.post('/api/todos', async (req, res) => {
    const { username, text } = req.body;
    if (!username || !text) return res.status(400).json({ error: '내용을 입력하세요.' });

    try {
        const result = await pool.query('INSERT INTO todos (username, text) VALUES ($1, $2) RETURNING id', [username, text]);
        res.json({ message: '할 일이 추가되었습니다.', id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [To-Do 상태 변경]
app.put('/api/todos/:id', async (req, res) => {
    const { done } = req.body;
    try {
        await pool.query('UPDATE todos SET done = $1 WHERE id = $2', [done, req.params.id]);
        res.json({ message: '상태가 변경되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [To-Do 삭제]
app.delete('/api/todos/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM todos WHERE id = $1', [req.params.id]);
        res.json({ message: '할 일이 삭제되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [기존 메시지 기능 (필요 시 유지)]
app.post('/api/messages', async (req, res) => {
    const { content, sender } = req.body;
    if (!content) return res.status(400).json({ error: '내용을 입력하세요.' });
    try {
        await pool.query('INSERT INTO messages (content, sender) VALUES ($1, $2)', [content, sender || '익명']);
        res.json({ message: '데이터 저장 성공!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/messages', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM messages ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 서버 실행
app.listen(PORT, () => {
    console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});