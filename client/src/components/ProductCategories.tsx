import { useState, type ReactNode } from "react";
import { CakeSlice, Cookie, Layers, CupSoda, Grid2X2 } from "lucide-react";
type Product = { id: string; name: string; category?: string };
export default function ProductCategories<T extends Product>({
  products,
  search,
  render,
}: {
  products: T[];
  search: string;
  render: (product: T) => ReactNode;
}) {
  const [category, select] = useState("");
  const name = (p: Product) => p.category?.trim() || "Other";
  const groups = [...new Set(products.map(name))].sort();
  const querying = !!search.trim();
  const matches = products.filter((p) =>
    querying
      ? p.name.toLowerCase().includes(search.trim().toLowerCase())
      : name(p) === category,
  );
  return (
    <div className="product-categories">
      {!querying && !category ? (
        <div className="category-tiles">
          {groups.map((g) => {
            const Icon =
              (
                {
                  Cheesecakes: CakeSlice,
                  Brownies: Layers,
                  Blondies: Layers,
                  Milkshakes: CupSoda,
                  Waffles: Grid2X2,
                  "Cookie Dough": Cookie,
                  "Cookie dough": Cookie,
                } as Record<string, typeof Cookie>
              )[g] ?? CakeSlice;
            return (
              <button
                key={g}
                className="secondary category-tile"
                onClick={() => select(g)}
              >
                <Icon size={32} aria-hidden="true" />
                <strong>{g}</strong>
                <small>
                  {products.filter((p) => name(p) === g).length}{" "}
                  {products.filter((p) => name(p) === g).length === 1
                    ? "product"
                    : "products"}
                </small>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <button
            className="text-button"
            onClick={() => select("")}
            hidden={querying}
          >
            ← Back to Categories
          </button>
          {!querying && <h3>{category}</h3>}
          <div className="dessert-results">{matches.map(render)}</div>
          {!matches.length && <p>No matching products.</p>}
        </>
      )}
      {!products.length && (
        <p>
          No sellable products yet. Add or edit a recipe in Recipes &amp;
          Ingredients.
        </p>
      )}
    </div>
  );
}
