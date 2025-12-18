import { useEffect, useState } from "react";

import type { Medication } from "../types";

import { getMedications, markDoseTaken, updateMedication } from "../lib/api";
import DoseCard from "./dose-card";

export default function MedicationList() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMedications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getMedications();
      setMedications(response.medications);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load medications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedications();
  }, []);

  const handleMarkDoseTaken = async (medicationId: string, doseId: string) => {
    try {
      await markDoseTaken(medicationId, doseId);
      await loadMedications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark dose as taken");
    }
  };

  const handleDeactivate = async (medicationId: string) => {
    try {
      await updateMedication(medicationId);
      await loadMedications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deactivate medication");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading medications...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>
      </div>
    );
  }

  if (medications.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No medications found</h2>
          <p className="text-gray-600">Add a medication to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Medication Management</h1>
      <div className="space-y-6">
        {medications.map(medication => (
          <div key={medication.medicationId} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-semibold">{medication.name}</h2>
                <p className="text-gray-600 mt-1">{medication.schedule}</p>
                <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{medication.recurrence}</span>
              </div>
              {medication.active && (
                <button type="button" onClick={() => handleDeactivate(medication.medicationId)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                  Deactivate
                </button>
              )}
            </div>
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Upcoming Doses</h3>
              <div className="space-y-2">
                {medication.doses.map(dose => (
                  <DoseCard key={dose.doseId} dose={dose} medicationId={medication.medicationId} onMarkTaken={handleMarkDoseTaken} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
