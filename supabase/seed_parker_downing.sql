-- Adds student "Parker Downing" with Lesson Plans 1 & 2, imported from the
-- Apple Notes exports "Parker Downing Lesson Plan 1.md" / "...2.md".
--
-- HOW TO RUN:
--   1. Open your Supabase project's SQL Editor.
--   2. If your project has more than one login account, replace
--      'YOUR_EMAIL_HERE' below with the email you log in with. With a
--      single account nothing needs editing.
--      this is how the script finds your account to own the new rows).
--   3. Run the whole script once. It is not safe to re-run — running it
--      twice will create a second "Parker Downing" folder.
--
-- Board positions were reconstructed by hand from the lesson's screenshots
-- and cross-checked against each puzzle's solution sequence, but weren't
-- pulled from the source apps directly — skim each one on the puzzle
-- editor's Setup tab against your own screenshot before presenting it to
-- Parker, especially puzzle 1 of Lesson 2 (Rook Endgame, "b3+") and puzzle
-- 5 of Lesson 2's Pawn Breaks section ("c5"), where the screenshots were
-- ambiguous about exact pawn placement.

DO $migration$
DECLARE
  v_user_id uuid;
  v_student_id uuid;
  v_lp1_id uuid;
  v_lp2_id uuid;
  v_sec_id uuid;
  v_next_order int;
BEGIN
  -- Single-coach planner: with exactly one login account, use it directly.
  -- With more than one account, put the right email in place of YOUR_EMAIL_HERE.
  IF (SELECT count(*) FROM auth.users) = 1 THEN
    SELECT id INTO v_user_id FROM auth.users;
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for that email — update the email at the top of this script.';
  END IF;

  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_next_order FROM students WHERE user_id = v_user_id;

  INSERT INTO students (user_id, name, color, sort_order)
  VALUES (v_user_id, 'Parker Downing', '#a9bfd9', v_next_order)
  RETURNING id INTO v_student_id;

  -- ===========================================================================
  -- Lesson Plan 1
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 1, '', ARRAY[
    'Puzzle Rush [2 play-throughs]',
    'Chessviz [5 variations]',
    'Pawn Break puzzles',
    'ChessKid Play'
  ])
  RETURNING id INTO v_lp1_id;

  -- --- Section: Tactics: Defending against Mate -----------------------------
  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp1_id, 'Tactics: Defending against Mate', 0)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'Qxd5+', '5rk1/pp1B3p/8/3p4/3bp1P1/1Q5P/5q2/PP1R3K', 'w',
   $q$Black is threatening mate. What would you suggest in this position?$q$,
   $s$Black is threatening mate. White must trade queens and get rid of the threat. The first move Qxd5 to begin the plan of trading queens.$s$,
   '[{"san":"Qxd5+"},{"san":"Kh8"},{"san":"Qxd4"},{"san":"Qxd4"},{"san":"Rxd4"}]'::jsonb,
   'https://lichess.org/study/t4d2Q44A/rCZ2owOP', 'Tactics: Defending against Mate (Chap 1)'),

  (v_sec_id, 1, 'Re1', '4R3/Q1p2pk1/1p6/Pp1b1p2/3q4/6P1/1P3P1P/6K1', 'w',
   $q$Black is threatening mate with Qd1. What would you suggest in this position?$q$,
   $s$Re1 protects the backrank and the mate-in-1 with Qd1.$s$,
   '[{"san":"Re1"}]'::jsonb,
   'https://lichess.org/study/t4d2Q44A/aMD0s3RD', 'Tactics: Defending against Mate (Chap 2)'),

  (v_sec_id, 2, 'Rg6', 'r7/pp3pr1/7R/1Pk5/2P5/1KN1P2P/8/8', 'b',
   $q$White is threatening mate with Ne4. What would you suggest in this position?$q$,
   $s$Rg6 blocks the white rook from controlling the 6th rank — which allows black to escape check when white plays Ne4+.$s$,
   '[{"san":"Rg6"},{"san":"Ne4+"},{"san":"Kb6"}]'::jsonb,
   'https://lichess.org/study/t4d2Q44A/aMD0s3RD', 'Tactics: Defending against Mate (Chap 2)'),

  (v_sec_id, 3, 'fxg4', '7k/R6p/5N2/2p2p2/3p1PP1/3b2K1/1r6/8', 'b',
   $q$White is threatening mate-in-1 with Rxh7. What would you suggest in this position?$q$,
   $s$White's best and only move is to play fxg4, allowing black's d3 bishop to protect h7.$s$,
   '[{"san":"fxg4"}]'::jsonb,
   'https://lichess.org/study/t4d2Q44A/RgNNZZqQ', 'Tactics: Defending against Mate (Chap 3)'),

  (v_sec_id, 4, 'Qd5', '8/p5pk/1b4p1/1Q6/2P1q3/6Pp/5P1P/5RK1', 'w',
   $q$Black is threatening mate-in-1 with Qg2#. What would you suggest in this position?$q$,
   $s$White needs to trade queens. The best move to play is Qd5 — adding a defender to g2 and offering a trade of queens to the black queen on e4.$s$,
   '[{"san":"Qd5"},{"san":"Qg2+"},{"san":"Qxg2"},{"san":"hxg2"},{"san":"Kxg2"}]'::jsonb,
   'https://lichess.org/study/t4d2Q44A/sCTfsADY', 'Tactics: Defending against Mate (Chap 4)');

  -- --- Section: Decision-Making for Beginners: Middlegame --------------------
  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp1_id, 'Decision-Making for Beginners: Middlegame', 1)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'Qxd1', 'r1bq1rk1/p1p3pp/1pp5/6B1/4p3/5N2/PP3PPP/R2QR1K1', 'b',
   $q$This is a very tactical rich position. What should black play here?$q$,
   $s$The best move for black is to trade queens with white and then capture the knight with exf3.$s$,
   '[{"san":"Qxd1"},{"san":"Raxd1"},{"san":"exf3"}]'::jsonb,
   'https://www.chessable.com/learn/384759/59222171/18/b', 'Decision-Making for Beginners: Middlegame (Quiz #2)'),

  (v_sec_id, 1, 'Qg5', 'r1bq2rk/5pp1/2bp2p1/8/1PB5/P5Q1/1BPn1PPP/R4R1K', 'b',
   $q$What would you suggest in this position?$q$,
   $s$White is threatening checkmate with Qxg7. Black must address with Qg5 — trading queen before playing Nxf1.$s$,
   '[{"san":"Qg5"},{"san":"Qxg5"},{"san":"Nxf1"},{"san":"Rxf1"},{"san":"Be6"}]'::jsonb,
   'https://www.chessable.com/learn/384759/59222172/18/b', 'Decision-Making for Beginners: Middlegame (Quiz #3)');

  -- ===========================================================================
  -- Lesson Plan 2
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 2, '', ARRAY[
    'Puzzle Rush [2 play-throughs]',
    'Pawn Endgame',
    'Create Lichess account'
  ])
  RETURNING id INTO v_lp2_id;

  -- --- Section: Endgame / Rook & Pawn Endgame ---------------------------------
  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp2_id, 'Endgame / Rook & Pawn Endgame', 0)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'b3+', '8/3k3p/5Rp1/3P4/rp2KPP1/7P/8/8', 'b',
   '', '',
   '[{"san":"b3+"},{"san":"Ke5"},{"san":"Rb4"}]'::jsonb,
   'https://lichess.org/training/jXEUf', 'Discovered Attack / Rook Endgame / Clearance'),

  (v_sec_id, 1, 'Kd5', '8/6k1/6P1/ppp1K3/8/1P6/P7/8', 'w',
   $q$White to move.$q$,
   $s$This is a pawn endgame with both sides having three pawns. Black's pawns are connected on the a-, b-, and c-files, while White has pawns on a2 and the b-file, plus an isolated pawn on g6 that the black king on g7 can capture. Despite this, White is winning with correct king play. The key move is Kd5! — bringing the king forward and attacking the pawn on c5. Black tries to hold the structure with c4, but White responds with bxc4, capturing the pawn. After Black recaptures with bxc4, White continues with Kxc6, capturing another pawn. While Black captures the isolated pawn on g6, White's king becomes very active — it moves to b5, attacking the pawn on a5 and preparing to create a passed pawn with the pawn on a2. Black tries to get back with Kf7, but it's too late: White captures the pawn on a5 and calmly advances the a-pawn all the way to promotion, winning the game.$s$,
   '[{"san":"Kd5"}]'::jsonb,
   'https://www.chess.com/puzzles/problem/2385452/practice', 'Endgame / Pawn Endgame'),

  (v_sec_id, 2, 'a6', '8/6p1/3k4/Pp5p/3Pp3/6PP/6K1/8', 'w',
   '', '',
   '[{"san":"a6"},{"san":"Kc6"},{"san":"d5+"},{"san":"Kb6"},{"san":"d6"},{"san":"Kxa6"},{"san":"d7"},{"san":"a7"},{"san":"d8=Q"}]'::jsonb,
   'https://lichess.org/training/egYZd', 'Pawn Endgame / Advanced Pawn'),

  (v_sec_id, 3, 'b6+', '8/2k2p2/P7/1PK5/8/8/7p/8', 'w',
   '',
   $s$In this endgame, both sides are racing to advance pawns. Black has a dangerous passed pawn on h3, just two squares from promotion, while White has pawns on a6 and b5, supported by the king on c5. A key detail is that the black king on c7 is far from its pawn, while White's king is already well placed. With correct play, White can take control. White begins with the forcing check b6+, gaining a valuable tempo. After Kb8, White improves the king with Kc6, stepping closer to support the advancing pawns. Black continues the race with h2. Now White keeps the initiative with another forcing check, a7+; after the king runs to a8, White plays b7+, again forcing Kxa7. With the king pulled away, White centralizes further with Kc7, and pushes the pawn to b8=Q, securing a winning position.$s$,
   '[{"san":"b6+"},{"san":"Kb8"},{"san":"Kc6"},{"san":"h2"},{"san":"a7+"},{"san":"Ka8"},{"san":"b7+"},{"san":"Kxa7"},{"san":"Kc7"},{"san":"b8=Q"}]'::jsonb,
   'https://lichess.org/training/dZFrG', 'Advanced Pawn / Endgame / Crushing');

  -- --- Section: Pawn Breaks ---------------------------------------------------
  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp2_id, 'Pawn Breaks', 1)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'b4', 'r5k1/1r3pb1/2p3pp/ppB5/q3P3/P2QP3/3R1PPP/3R2K1', 'b',
   '', '',
   '[{"san":"b4"},{"san":"axb4"},{"san":"axb4"}]'::jsonb,
   'https://www.chessable.com/learn/204608/48530637/11/b', 'Pawn Breaks #4'),

  (v_sec_id, 1, 'c6', '8/1pp5/p7/1PP5/P2k4/8/4K3/8', 'w',
   $q$What should white play? Explain some theory point related to pawn breakthrough and endgame.$q$,
   '',
   '[{"san":"c6"},{"san":"b6"},{"san":"bxa6"},{"san":"Kc5"},{"san":"a7"}]'::jsonb,
   'https://lichess.org/study/ckFlr4fp/stsQ22hW', 'Pawn Breaks #5'),

  (v_sec_id, 2, 'g5', 'r2qr1k1/1b1nbpp1/1pp1pn1p/p2p4/2PP2PP/1PNBPN2/P2BQP2/2KR2R1', 'w',
   '',
   $s$This pawn break is all about breaking the pawns up in front of your opponent's king. If Black captures with hxg5 then hxg5, and this opens up the h-file for the rooks and queen to attack the black king. Black doesn't have time to push to a4 or b5 since they must now go on defense.$s$,
   '[{"san":"g5"}]'::jsonb,
   'https://www.chessable.com/learn/204608/43896368/11', 'Pawn Breaks #6'),

  (v_sec_id, 3, 'g6', '8/p3k1pp/7P/4K1P1/8/8/8/8', 'w',
   '', '',
   '[{"san":"g6"},{"san":"hxg6"},{"san":"h7"}]'::jsonb,
   'https://lichess.org/study/ckFlr4fp/SCxghW4m', 'Pawn Breaks #7'),

  (v_sec_id, 4, 'c5', '8/7p/1p3k2/8/P1P2K2/8/6P1/8', 'w',
   '', '',
   '[{"san":"c5"},{"san":"bxc5"},{"san":"a5"},{"san":"c4"},{"san":"a6"},{"san":"c3"},{"san":"Ke3"},{"san":"c2"},{"san":"Kd2"},{"san":"c1"},{"san":"Kxc1"}]'::jsonb,
   'https://lichess.org/study/ckFlr4fp', 'Pawn Breaks #8');

  RAISE NOTICE 'Added student % with lesson plans % and %', v_student_id, v_lp1_id, v_lp2_id;
END;
$migration$;
