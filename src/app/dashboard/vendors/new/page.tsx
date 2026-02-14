import { redirect } from "next/navigation";

export default function VendorCreatePage(): never {
  redirect("/dashboard/vendors?modal=create");
}
