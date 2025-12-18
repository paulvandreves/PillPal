// This component can be used for more advanced schedule selection in the future
// For now, it's a simple component that can be extended

type ScheduleSelectorProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function ScheduleSelector({ value, onChange }: ScheduleSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="e.g., 8:00 AM, 2:00 PM"
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
