import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initStudySync } from "./features/study/studySync";
import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import "./index.css";
import "./styles/design.css";
import { applyDesign } from "./lib/design";

applyDesign();
initStudySync();
createRoot(document.getElementById("root")!).render(<App />);
