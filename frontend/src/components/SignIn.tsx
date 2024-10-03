"use client"
import { signIn } from "next-auth/react"
import { Button } from "@mui/material"

export default function SignIn() {
  const handleSignIn = () => {
    signIn("google", { prompt: "select_account" })
  }

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={handleSignIn}
    >
      Sign in with Google
    </Button>
  )
}