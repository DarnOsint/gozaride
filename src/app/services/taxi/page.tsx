export default function TaxiPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Taxi Rides</h1>
        <p className="text-gray-600">Book a ride in seconds</p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-2xl bg-white p-4 shadow">
          <h3 className="font-medium text-gray-900">Book Now</h3>
          <p className="text-gray-500 mt-2">Schedule a ride anytime, anywhere</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow">
          <h3 className="font-medium text-gray-900">Track Ride</h3>
          <p className="text-gray-500 mt-2">Real-time GPS tracking</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow">
          <h3 className="font-medium text-gray-900">Rate Driver</h3>
          <p className="text-gray-500 mt-2">Share your feedback</p>
        </div>
      </div>
    </div>
  );
}