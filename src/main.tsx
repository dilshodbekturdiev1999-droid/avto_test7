import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initStudySync } from "./features/study/studySync";
import { initExamDateSync } from "./features/celebrate/examDateSync";
import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import "./index.css";
import "./styles/design.css";
import "./styles/site.css";
import { applyDesign } from "./lib/design";

applyDesign();
initStudySync();
initExamDateSync();
createRoot(document.getElementById("root")!).render(<App />);
