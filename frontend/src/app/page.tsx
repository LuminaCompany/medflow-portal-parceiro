import { redirect } from "next/navigation";

// Raiz → portal. A guarda do layout do portal redireciona ao login se não autenticado.
export default function Home() {
  redirect("/dashboard");
}
