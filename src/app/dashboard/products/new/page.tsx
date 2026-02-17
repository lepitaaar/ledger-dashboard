import { redirect } from "next/navigation";

export default function ProductCreatePage(): never {
  redirect("/dashboard/products?modal=create");
}
