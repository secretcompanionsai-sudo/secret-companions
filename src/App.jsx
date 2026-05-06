import { useState } from "react";
import AgeGate from "./AgeGate.jsx";
import DollGalleryPage from "./DollGalleryPage.jsx";

export default function App() {
  const [isVerified, setIsVerified] = useState(false);

  if (!isVerified) {
    return <AgeGate onVerified={() => setIsVerified(true)} />;
  }

  return <DollGalleryPage />;
}
