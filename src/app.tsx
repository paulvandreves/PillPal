import { useState } from "react";

import MedicationForm from "./components/medication-form";
import MedicationList from "./components/medication-list";

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMedicationAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center text-gray-800">PillPal</h1>
        <div className="mb-8">
          <MedicationForm onSuccess={handleMedicationAdded} onCancel={() => {}} />
        </div>
        <MedicationList key={refreshKey} />
      </div>
    </div>
  );
}
