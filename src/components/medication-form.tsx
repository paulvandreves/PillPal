import { useState } from "react";

import type { CreateMedicationRequest } from "../types";

import { createMedication } from "../lib/api";

type MedicationFormProps = {
  onMedicationAdded: () => void;
};

export default function MedicationForm({ onMedicationAdded }: MedicationFormProps) {
  const [formData, setFormData] = useState<CreateMedicationRequest>({
    name: "",
    schedule: "",
    recurrence: "daily",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createMedication(formData);
      setFormData({ name: "", schedule: "", recurrence: "daily" });
      onMedicationAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create medication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-container">
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
      
      <div className="form-group">
        <label htmlFor="name" className="form-label">
          Medication Name
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          className="form-input"
          placeholder="Enter medication name"
        />
      </div>

      <div className="form-group">
        <label htmlFor="schedule" className="form-label">
          Schedule
        </label>
        <input
          type="text"
          id="schedule"
          required
          value={formData.schedule}
          onChange={e => setFormData({ ...formData, schedule: e.target.value })}
          placeholder="e.g., 8:00 AM, 2:00 PM"
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="recurrence" className="form-label">
          Recurrence
        </label>
        <select
          id="recurrence"
          value={formData.recurrence}
          onChange={e =>
            setFormData({
              ...formData,
              recurrence: e.target.value as "daily" | "weekly",
            })}
          className="form-select"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary btn-full">
        {loading ? "Creating..." : "Create Medication"}
      </button>
    </form>
  );
}
