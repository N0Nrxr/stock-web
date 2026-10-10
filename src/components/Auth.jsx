import React, { useState } from 'react';
import { auth, db } from './firebase'; // ปรับ path ตามตำแหน่งไฟล์ firebase.js ของคุณ
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function Auth({ user }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        // สมัครสมาชิกใหม่
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // สร้างข้อมูลเริ่มต้นใน Firestore สำหรับผู้ใช้คนนี้
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: email,
          createdAt: new Date()
        });
      } else {
        // เข้าสู่ระบบ
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (user) {
    return (
      <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>👤 เข้าสู่ระบบด้วย: <b>{user.email}</b></span>
        <button 
          onClick={() => signOut(auth)} 
          style={{ background: '#ff4d4d', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
        >
          ออกจากระบบ
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>{isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input 
          type="email" 
          placeholder="อีเมล" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required
          style={{ padding: '8px', fontSize: '16px' }}
        />
        <input 
          type="password" 
          placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required
          style={{ padding: '8px', fontSize: '16px' }}
        />
        <button 
          type="submit" 
          style={{ padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
        >
          {isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
        </button>
      </form>
      <p style={{ marginTop: '15px', textAlign: 'center' }}>
        {isRegister ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'} {' '}
        <span 
          onClick={() => setIsRegister(!isRegister)} 
          style={{ color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {isRegister ? 'เข้าสู่ระบบที่นี่' : 'สมัครสมาชิกที่นี่'}
        </span>
      </p>
    </div>
  );
}