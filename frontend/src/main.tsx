/**
 * Sentinel-X — Application Entry Point
 *
 * Mounts the React application into the #root DOM element.
 * Applies global Tailwind CSS styles.
 * Wraps the app in BrowserRouter and AuthProvider.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import App from "./App";

import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error(
    "Fatal: #root element not found in index.html. Cannot mount Sentinel-X."
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);