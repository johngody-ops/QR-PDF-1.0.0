import React from 'react';
import ReactDOM from 'react-dom/client';
import './app.css';
import App from './App';

console.log("[v0] index.tsx loaded, attempting to mount React app");

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

console.log("[v0] root element found, creating React root");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log("[v0] React root.render() called");
