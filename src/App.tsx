import React from 'react';
import './App.css';
import { CardAnimation } from './components/card-animation';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CardWorkbench } from './routes/CardWorkbench';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CardAnimation />} />
        <Route path="/card" element={<CardWorkbench />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
//140, 28, 157
