import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initStudySync } from "./features/study/studySync";
import "./index.css";

initStudySync();
createRoot(document.getElementById("root")!).render(<App />);
