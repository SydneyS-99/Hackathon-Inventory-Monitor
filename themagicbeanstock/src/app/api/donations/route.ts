import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") ?? "40000"; // meters (max 40000 on Yelp)


  if (!process.env.YELP_API_KEY) {
    return NextResponse.json({ error: "Missing YELP_API_KEY" }, { status: 500 });
  }
  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing lat/lng" }, { status: 400 });
  }

  // Hackathon-friendly approach: use "term" with multiple donation-related keywords.
  // (You CAN also add `categories=` using aliases from Yelp's categories list.)
  const term = "food bank OR foodbanks OR food pantry OR donation center OR community fridge OR homelessshelters OR donationcenter OR ranches";

  const url = new URL("https://api.yelp.com/v3/businesses/search");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lng);
  url.searchParams.set("radius", radius);
  url.searchParams.set("sort_by", "distance");
  url.searchParams.set("term", term);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.YELP_API_KEY}`,
    },
    // avoid caching during hackathon debugging
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    return NextResponse.json(
      { error: "Yelp request failed", status: res.status, detail: txt },
      { status: 500 }
    );
  }

  const data = await res.json();

  // Return only what we need
  const businesses =
    (data.businesses ?? []).map((b: any) => ({
      id: b.id,
      name: b.name,
      url: b.url,
      phone: b.display_phone,
      rating: b.rating,
      reviewCount: b.review_count,
      distanceMeters: b.distance,
      location: b.location,
      coordinates: b.coordinates,
      categories: b.categories?.map((c: any) => c.title) ?? [],
      imageUrl: b.image_url,
    })) || [];

  return NextResponse.json({ businesses });
}
