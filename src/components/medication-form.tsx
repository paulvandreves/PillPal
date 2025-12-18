import { useState } from "react";

import type { CreateMedicationRequest } from "../types";

import { createMedication } from "../lib/api";

type MedicationFormProps = {
  onSuccess: () => void;
  onCancel: () => void;
};

export default function MedicationForm({ onSuccess, onCancel }: MedicationFormProps) {
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
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create medication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4">Add New Medication</h2>
      {error && <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Medication Name
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="schedule" className="block text-sm font-medium text-gray-700 mb-1">
            Schedule
          </label>
          <input
            type="text"
            id="schedule"
            required
            value={formData.schedule}
            onChange={e => setFormData({ ...formData, schedule: e.target.value })}
            placeholder="e.g., 8:00 AM, 2:00 PM"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="recurrence" className="block text-sm font-medium text-gray-700 mb-1">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
            {loading ? "Creating..." : "Create Medication"}
          </button>
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
