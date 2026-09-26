export type Section = "Overview" | "Play & Study" | "Exams" | "Study Rooms" | "Leaderboard" | "My Profile";
export type Subject = { id: string; name: string; detail: string; progress: number; tone: "mint" | "coral" | "blue" | "gold"; icon: string };

export const navigation: Section[] = [
  "Overview",
  "Play & Study",
  "Exams",
  "Study Rooms",
  "Leaderboard",
  "My Profile",
];

