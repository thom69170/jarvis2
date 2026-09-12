import { Route, Routes } from "react-router-dom";
import Admin from "./pages/Admin";
import Home from "./pages/Home";
import Jarvis from "./pages/Jarvis";
import Overlay from "./pages/Overlay";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/jarvis" element={<Jarvis />} />
      <Route path="/overlay" element={<Overlay />} />
    </Routes>
  );
}
