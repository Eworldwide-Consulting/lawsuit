import { Check } from 'lucide-react';

export default function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="progress-step">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                done ? 'bg-green-500 text-white' : active ? 'bg-navy-900 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {done ? <Check size={14} /> : i + 1}
              </div>
              <div className={`text-[10px] mt-1 font-medium text-center max-w-[70px] ${active ? 'text-navy-900' : done ? 'text-green-600' : 'text-gray-400'}`}>
                {step}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-12 mx-1 mb-4 transition-colors ${done ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
