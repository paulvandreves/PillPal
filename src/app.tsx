import { useState } from "react";

import "./app.css";
import MedicationForm from "./components/medication-form";
import MedicationList from "./components/medication-list";

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMedicationAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="app-container">
      <header className="hero-section">
        <h1 className="hero-title">💊 PillPal</h1>
        <p className="hero-subtitle">Your Personal Medication Manager</p>
        <p className="hero-description">
          Stay on top of your health with smart medication tracking and timely reminders
        </p>
      </header>

      <div className="content-grid">
        <div className="card">
          <h2 className="card-title">
            <span className="icon">➕</span>
            Add Medication
          </h2>
          <MedicationForm onMedicationAdded={handleMedicationAdded} />
        </div>

        <div className="card full-width-card">
          <h2 className="card-title">
            <span className="icon">📋</span>
            Your Medications
          </h2>
          <MedicationList key={refreshKey} />
        </div>
      </div>

    </div>
  );
}
