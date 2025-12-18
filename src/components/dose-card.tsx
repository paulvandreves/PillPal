import type { Dose } from "../types";

type DoseCardProps = {
  dose: Dose;
  medicationName: string;
  schedule: number; // Hour in 24-hour format (0-23)
  onMarkTaken: (medicationName: string, nextDoseTime: string) => void;
};

export default function DoseCard({ dose, medicationName, schedule, onMarkTaken }: DoseCardProps) {
  const isTaken = dose.lastTaken !== undefined && dose.lastTaken > 0;

  // Convert Unix timestamp to formatted local date (without time)
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);

    // Format: "Jan 15, 2024"
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };

    return date.toLocaleDateString("en-US", options);
  };

  // Format schedule hour as 24-hour time
  const formatScheduleTime = (hour: number): string => {
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  const nextDoseDate = formatDate(dose.nextDoseTime);
  const scheduleTime = formatScheduleTime(schedule);
  const takenDate = isTaken && dose.lastTaken ? formatDate(dose.lastTaken) : null;

  return (
    <div className="dose-card">
      <div className="dose-info">
        <span className="dose-id">
          Next dose:
          {" "}
          {nextDoseDate}
          {" "}
          at
          {" "}
          {scheduleTime}
        </span>
        {isTaken && takenDate && (
          <span className="dose-taken">
            ✓ Taken
            <span className="dose-taken-time">
              on
              {" "}
              {takenDate}
            </span>
          </span>
        )}
      </div>
      {!isTaken && (
        <button
          type="button"
          onClick={() => onMarkTaken(medicationName, String(dose.nextDoseTime))}
          className="btn-mark-taken"
        >
          Mark as Taken
        </button>
      )}
      {isTaken && (
        <span className="badge-taken">
          ✓ Completed
        </span>
      )}
    </div>
  );
}
