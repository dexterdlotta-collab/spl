type Table<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: Table<{ id: string; display_name: string; xp: number; created_at: string }, { id: string; display_name?: string }, { display_name?: string }>;
      subjects: Table<{ id: string; name: string; description: string; icon: string; tone: "mint" | "coral" | "blue" | "gold"; created_by: string; created_at: string }, { name: string; description?: string; icon?: string; tone?: "mint" | "coral" | "blue" | "gold"; created_by: string }, { name?: string; description?: string; icon?: string; tone?: "mint" | "coral" | "blue" | "gold" }>;
      questions: Table<{ id: string; subject_id: string; prompt: string; options: Json; correct_answer: string; created_by: string; published: boolean; created_at: string }, { subject_id: string; prompt: string; options: Json; correct_answer: string; created_by: string; published?: boolean }, { subject_id?: string; prompt?: string; options?: Json; correct_answer?: string; published?: boolean }>;
      flashcards: Table<{ id: string; subject_id: string; front: string; back: string; created_by: string; created_at: string }, { subject_id: string; front: string; back: string; created_by: string }, never>;
      subject_progress: Table<{ user_id: string; subject_id: string; answered: number; correct: number; last_studied_at: string | null }, never, never>;
      answer_events: Table<{ id: string; user_id: string; subject_id: string; is_correct: boolean; created_at: string }, never, never>;
      exam_plans: Table<{ id: string; owner_id: string; subject_id: string; title: string; question_count: number; created_at: string }, { owner_id: string; subject_id: string; title: string; question_count: number }, { owner_id?: string; subject_id?: string; title?: string; question_count?: number }>;
      exam_attempts: Table<{ id: string; exam_id: string; user_id: string; score: number; total_questions: number; completed_at: string | null; created_at: string }, { exam_id: string; user_id: string; score: number; total_questions: number; completed_at?: string }, { exam_id?: string; user_id?: string; score?: number; total_questions?: number; completed_at?: string }>;
      study_rooms: Table<{ id: string; created_by: string; subject_id: string | null; title: string; created_at: string }, { created_by: string; subject_id?: string | null; title: string }, { created_by?: string; subject_id?: string | null; title?: string }>;
      room_members: Table<{ room_id: string; user_id: string; joined_at: string }, { room_id: string; user_id: string }, never>;
      room_messages: Table<{ id: string; room_id: string; user_id: string; content: string; created_at: string }, { room_id: string; user_id: string; content: string }, never>;
    };
    Views: Record<string, never>;
    Functions: { grade_answer: { Args: { p_question_id: string; p_answer: string }; Returns: { correct: boolean; xp_awarded: boolean } } };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
