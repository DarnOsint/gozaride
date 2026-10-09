import Link from "next/link";

export const metadata = { title: "Move Easy. Go Anywhere." };

const SERVICES = [
  { href: "/services/taxi", icon: "🚕", name: "Taxi rides", text: "Book a ride to anywhere in town with a verified driver." },
  { href: "/services/motorcycle", icon: "🛵", name: "Motorcycle delivery", text: "Documents and small parcels, delivered fast." },
  { href: "/services/package", icon: "📦", name: "Package delivery", text: "Send larger parcels with tracking from pickup to drop-off." },
  { href: "/services/food", icon: "🍔", name: "Food delivery", text: "Meals from local restaurants, brought to your door." },
  { href: "/services/rental", icon: "🚗", name: "Car rental", text: "Self-drive and with-driver rentals for any occasion." },
  { href: "/services/bus", icon: "🚌", name: "Transport", text: "Shared transport routes across the city." },
];

export default function HomePage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-orange-50 to-white px-4 py-20 text-center">
        <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
          Move Easy. <span className="text-orange-600">Go Anywhere.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          One app for rides, deliveries, food and rentals across South Sudan.
          Prices shown in US dollars and South Sudanese pounds.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="rounded-xl bg-orange-600 px-6 py-3 font-medium text-white hover:bg-orange-700">
            Get started
          </Link>
          <Link href="/services/taxi" className="rounded-xl border border-orange-600 px-6 py-3 font-medium text-orange-600 hover:bg-orange-50">
            Book a ride
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="text-4xl">{s.icon}</div>
            <h2 className="mt-3 text-xl font-semibold">{s.name}</h2>
            <p className="mt-2 text-gray-600">{s.text}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
