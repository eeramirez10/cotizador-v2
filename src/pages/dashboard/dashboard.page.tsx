export const DashboardPage = () => {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase text-gray-500">Cotizaciones Hoy</h3>
        <p className="mt-4 text-3xl font-bold text-gray-800">0</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase text-gray-500">Pendientes</h3>
        <p className="mt-4 text-3xl font-bold text-amber-500">0</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase text-gray-500">Finalizadas</h3>
        <p className="mt-4 text-3xl font-bold text-emerald-600">0</p>
      </div>
    </div>
  );
};
