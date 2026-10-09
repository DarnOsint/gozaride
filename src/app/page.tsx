export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">
          Welcome to <span className="text-orange-600">Gozaride</span>
        </h1>
        <p className="text-lg text-gray-600 mt-2">
          Move Easy. Go Anywhere.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <a href="/services/taxi" className="group rounded-2xl bg-white p-6 shadow-lg hover:shadow-2xl hover:transition-shadow duration-300">
          <div className="text-3xl mb-2">🚕</div>
          <h3 className="font-semibold text-gray-900">Taxi Rides</h3>
          <p className="text-gray-500 mt-1">Book rides instantly</p>
        </a>

        <a href="/services/motorcycle" className="group rounded-2xl bg-white p-6 shadow-lg hover:shadow-2xl hover:transition-shadow duration-300">
          <div className="text-3xl mb-2">🛵</div>
          <h3 className="font-semibold text-gray-900">Motorcycle Delivery</h3>
          <p className="text-gray-500 mt-1">Fast delivery service</p>
        </a>

        <a href="/services/package" className="group rounded-2xl bg-white p-6 shadow-lg hover:shadow-2xl hover:transition-shadow duration-300">
          <div className="text-3xl mb-2">📦</div>
          <h3 className="font-semibold text-gray-900">Package Delivery</h3>
          <p className="text-gray-500 mt-1">Secure parcel service</p>
        </a>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        <a href="/services/food" className="group rounded-2xl bg-white p-6 shadow-lg hover:shadow-2xl hover:transition-shadow duration-300">
          <div className="text-3xl mb-2">🍔</div>
          <h3 className="font-semibold text-gray-900">Food Delivery</h3>
          <p className="text-gray-500 mt-1">Hot meals delivered</p>
        </a>

        <a href="/services/rental" className="group rounded-2xl bg-white p-6 shadow-lg hover:shadow-2xl hover:transition-shadow duration-300">
          <div className="text-3xl mb-2">🚗</div>
          <h3 className="font-semibold text-gray-900">Car Rental</h3>
          <p className="text-gray-500 mt-1">Rent a vehicle</p>
        </a>

        <a href="/services/bus" className="group rounded-2xl bg-white p-6 shadow-lg hover:shadow-2xl hover:transition-shadow duration-300">
          <div className="text-3xl mb-2">🚌</div>
          <h3 className="font-semibold text-gray-900">Transport Services</h3>
          <p className="text-gray-500 mt-1">Public transit options</p>
        </a>
      </section>
    </div>
  );
}