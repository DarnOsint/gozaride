export default function MotorcyclePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Motorcycle Delivery</h1>
        <p className="text-gray-600">Fast and reliable delivery service</p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-2xl bg-white p-4 shadow">
          <h3 className="font-medium text-gray-900">Book Delivery</h3>
          <p className="text-gray-500 mt-2">Delight your customers fast</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow">
          <h3 className="font-medium text-gray-900">Track Order</h3>
          <p className="text-gray-500 mt-2">Live order tracking</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow">
          <h3 className="font-medium text-gray-900">Rate Rider</h3>
          <p className="text-gray-500 mt-2">Share your feedback</p>
        </div>
      </div>
    </div>
  );
}