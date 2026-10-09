import Link from "next/link";

export type ServiceInfo = {
  slug: string;
  title: string;
  icon: string;
  summary: string;
  bullets: string[];
};

export function ServicePage({ service }: { service: ServiceInfo }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-5xl">{service.icon}</div>
      <h1 className="mt-4 text-4xl font-bold">{service.title}</h1>
      <p className="mt-3 text-lg text-gray-600">{service.summary}</p>

      <ul className="mt-8 space-y-3">
        {service.bullets.map((b) => (
          <li key={b} className="flex gap-3 rounded-xl bg-white p-4 ring-1 ring-gray-200">
            <span className="text-orange-600">●</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex gap-3">
        <Link
          href={`/customer?service=${service.slug}`}
          className="rounded-xl bg-orange-600 px-6 py-3 font-medium text-white hover:bg-orange-700"
        >
          Request {service.title.toLowerCase()}
        </Link>
        <Link href="/signin" className="rounded-xl border border-gray-300 px-6 py-3 font-medium hover:bg-gray-100">
          Sign in first
        </Link>
      </div>
    </div>
  );
}
