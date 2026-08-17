"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    // // dev bypass
    // document.cookie = `userRole=admin; path=/; SameSite=Strict`;
    // document.cookie = `username=${username || "dev"}; path=/; SameSite=Strict`;

    // router.push("/admin/home"); // or "/annotator/home"
    // return
    
    if (!username) {
      setError("Please enter a username.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError("User not found.");
        } else {
          setError("An error occurred while logging in.");
        }
        setLoading(false); // Reset loading state
        return;
      }

      const user = await res.json();
      console.log("user", user)
      document.cookie = `userRole=${user.role}; path=/; SameSite=Strict`;
      document.cookie = `username=${user.username}; path=/; SameSite=Strict`;
      document.cookie = `userAccessGroup=${user.accessGroup}; path=/; SameSite=Strict`;
      console.log("accessGroup: ", user.accessGroup)

      if (user.role === "admin") {
        router.push("/admin/home");
      } else if (user.role === "annotator") {
        router.push("/annotator/home");
      } else {
        setError("Invalid role.");
      }
    } catch (err) {
      console.error("Login failed:", err);
      setError("An error occurred. Please try again later.");
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-800 flex-col">
      <motion.div>
        <motion.h1
          className="text-4xl font-bold text-white mb-8"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          Chat Log Annotators
        </motion.h1>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-gray-700 p-6 rounded-lg shadow-lg"
      >
        <motion.h2
          className="text-2xl font-bold text-white mb-4"
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Login
        </motion.h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <input
          type="text"
          placeholder="Enter your username"
          className="w-full px-4 py-2 rounded bg-gray-600 text-white focus:outline-none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button
          onClick={handleLogin}
          className={`mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-400 focus:outline-none transition ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={loading} // Disable button while loading
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        {loading && (
          <div className="flex justify-center mt-4">
            <motion.div
              className="h-5 w-5 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2 }}
            ></motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
