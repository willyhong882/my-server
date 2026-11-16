const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

// 미들웨어 설정 (다른 곳에서 오는 요청 허용, JSON 데이터 읽기 허용)
app.use(cors());
app.use(express.json());

// ==========================================
// 1. 데이터베이스(DB) 연결 및 테이블 생성
// ==========================================
const db = new sqlite3.Database('./mydb.sqlite', (err) => {
    if (err) console.error(err.message);
    console.log('✅ 데이터베이스에 연결되었습니다.');
});

db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    sender TEXT
)`, (err) => {
    if (err) console.error(err.message);
    console.log('✅ messages 테이블이 준비되었습니다.');
});

// ==========================================
// 2. API 만들기 (데이터를 주고받는 창구)
// ==========================================

// [POST] 데이터 저장하기 (외부에서 데이터가 들어오면 저장)
app.post('/api/messages', (req, res) => {
    const { content, sender } = req.body;
    
    if (!content) {
        return res.status(400).json({ error: '내용(content)을 입력하세요.' });
    }

    const sql = `INSERT INTO messages (content, sender) VALUES (?, ?)`;
    db.run(sql, [content, sender || '익명'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ 
            message: '데이터가 성공적으로 저장되었습니다!', 
            id: this.lastID 
        });
    });
});

// [GET] 데이터 불러오기 (내 프로그램에서 데이터를 볼 때)
app.get('/api/messages', (req, res) => {
    const sql = `SELECT * FROM messages ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// [DELETE] 데이터 삭제하기 (내 프로그램에서 Send/삭제할 때)
app.delete('/api/messages/:id', (req, res) => {
    const id = req.params.id;
    const sql = `DELETE FROM messages WHERE id = ?`;
    db.run(sql, id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `${id}번 데이터가 삭제되었습니다.` });
    });
});

// 서버 실행
app.listen(PORT, () => {
    console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});