import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCL7tS0MJUBsf9eWUzJKBzIn5lhyY6Ly9Q",
  authDomain: "sondar-12d3a.firebaseapp.com",
  projectId: "sondar-12d3a",
  storageBucket: "sondar-12d3a.firebasestorage.app",
  messagingSenderId: "466827887846",
  appId: "1:466827887846:web:cd208b241e3cdef238a727",
  measurementId: "G-SR1CYRFXNC"
};

const app = initializeApp(firebaseConfig);

// 👉 EXPORT CORRECTO
export const auth = getAuth(app);