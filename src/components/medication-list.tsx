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

  const handleMarkDoseTaken = async (medicationName: string, nextDoseTime: string) => {
    try {
      await markDoseTaken(medicationName, nextDoseTime);
      await loadMedications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark dose as taken");
    }
  };

  const handleDeactivate = async (medicationName: string) => {
    try {
      await updateMedication(medicationName);
      await loadMedications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deactivate medication");
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-text">Loading medications...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-container">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  if (medications.length === 0) {
    return (
      <div className="empty-state">
        <div>
          <h2 className="empty-state-title">No medications yet</h2>
          <p className="empty-state-text">Add your first medication to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="medication-list">
      {medications.map(medication => (
        <div key={medication.name} className="medication-card">
          <div className="medication-header">
            <div className="medication-info">
              <h2 className="medication-name">{medication.name}</h2>
              <p className="medication-schedule">
                {medication.schedule.toString().padStart(2, "0")}
                :00
              </p>
              <span className={`badge badge-${medication.recurrence}`}>
                {medication.recurrence}
              </span>
            </div>
            {medication.active && (
              <button
                type="button"
                onClick={() => handleDeactivate(medication.name)}
                className="btn-deactivate"
              >
                Deactivate
              </button>
            )}
          </div>
          <div className="dose-section">
            <h3 className="dose-section-title">Upcoming Doses</h3>
            <div className="dose-list">
              {medication.doses.map(dose => (
                <DoseCard
                  key={dose.nextDoseTime}
                  dose={dose}
                  medicationName={medication.name}
                  schedule={medication.schedule}
                  onMarkTaken={handleMarkDoseTaken}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
