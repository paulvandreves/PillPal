import type { Dose } from "../types";

type DoseCardProps = {
  dose: Dose;
  medicationId: string;
  onMarkTaken: (medicationId: string, doseId: string) => void;
};

export default function DoseCard({ dose, medicationId, onMarkTaken }: DoseCardProps) {
  const isTaken = dose.lastTaken !== undefined && dose.lastTaken > 0;
  const takenDate = isTaken && dose.lastTaken ? new Date(dose.lastTaken * 1000).toLocaleString() : null;

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
      <div>
        <span className="font-medium">
          Dose
          {dose.doseId}
        </span>
        {isTaken && takenDate && (
          <span className="ml-2 text-sm text-green-600">
            Taken:
            {takenDate}
          </span>
        )}
      </div>
      {!isTaken && (
        <button type="button" onClick={() => onMarkTaken(medicationId, dose.doseId)} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
          Mark as Taken
        </button>
      )}
      {isTaken && <span className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm">✓ Taken</span>}
    </div>
  );
}
