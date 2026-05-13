import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">FoodFlow</h1>
      <p className="text-gray-500">AI 驱动的饮食记录与营养分析</p>
      <div className="flex gap-4 mt-4">
        <Link href="/login" className="text-green-600 underline">
          登录
        </Link>
        <Link href="/register" className="text-green-600 underline">
          注册
        </Link>
      </div>
    </main>
  );
}
