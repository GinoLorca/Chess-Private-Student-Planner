-- Imports Jojo's Lesson Plans 1-10 from the Apple Notes exports
-- "Jojo Lesson Plan 1.md" ... "Jojo Lesson Plan 10.md" (Google Drive:
-- My Drive > Chess > Chess Apps > Private Lesson Planner > Jojo Lesson Plans).
--
-- HOW TO RUN:
--   1. Open your Supabase project's SQL Editor.
--   2. Replace 'YOUR_EMAIL_HERE' below with the email you log into the
--      planner with.
--   3. Confirm the student name match below (v_student_name) matches the
--      "Joseph "Jojo" Liu" student already in your dashboard exactly —
--      this script looks the student UP, it does not create one.
--   4. Run the whole script once. It is not safe to re-run — running it
--      twice will duplicate all ten lesson plans.
--
-- Board positions were reconstructed by hand from each puzzle's screenshot.
-- The overwhelming majority of these screenshots show the position AFTER
-- the solution move was already played (MoveTrainer mode), so every
-- starting_fen below is the reverse-engineered "before" position, checked
-- for legality and cross-referenced against the coach's own explanation
-- text. A few puzzles carry extra notes (in this file's comments, and in
-- more detail in the coach's own working notes) where the reversal or an
-- exact square had lower confidence than the rest — skim those against
-- your own screenshots before presenting to Jojo:
--   - Lesson 1, puzzle "O-O": source notes literally say "0-0-0" but the
--     screenshot unambiguously shows a kingside castle. Used O-O.
--   - Lesson 3, puzzle "Re1+": notation lacks the "+" in the coach's notes;
--     the reconstructed position has this rook move giving check, so it's
--     included for accuracy.
--   - Lesson 3, puzzle "Qxe2": SKIPPED — no image was attached in the
--     source note for this entry.
--   - Lesson 7, puzzle "Be3" (labeled #11 in the coach's notes): SKIPPED —
--     the attached image is a duplicate of a different puzzle's screenshot
--     (a data-entry error in the source note), so no real position exists
--     for it.
--   - Lesson 7, puzzle "Bc5" pre-move bishop square, Lesson 9 puzzle "Bd5"
--     pre-move bishop square, and Lesson 10 puzzle "Rf8" pre-move rook
--     square: the exact origin square was inferred (not explicitly stated
--     anywhere) as the most sensible retreat/development square consistent
--     with the rest of the position and the coach's explanation.
--   - Lesson 10, "Can I Take It? #1" (h4): no white h-pawn was visible
--     anywhere in the screenshot despite the coach's own explanation
--     requiring one ("White must push the h-pawn") — added a pawn on h2
--     by inference so the position is playable. Worth a real screenshot
--     check against Jojo's original app.

DO $migration$
DECLARE
  v_user_id uuid;
  v_student_id uuid;
  v_student_name text := 'Joseph "Jojo" Liu';
  v_lp_id uuid;
  v_sec_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for that email — update the email at the top of this script.';
  END IF;

  SELECT id INTO v_student_id FROM students WHERE user_id = v_user_id AND name = v_student_name;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'No student named % found — check the name matches your dashboard exactly, or create the student first.', v_student_name;
  END IF;

  -- ===========================================================================
  -- Lesson Plan 1
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 1, '', ARRAY[]::text[])
  RETURNING id INTO v_lp_id;

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Defend and Protect', 0)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'Rc1', 'r2qkbnr/1pp1pppb/p6p/3p4/1n1P1B2/2N2N2/PPP1PPPP/1R1QKB1R w - - 0 1', 'w',
   '', $s$Any other move loses material. Bh7 and Nb4 are threatening to fork the a1-rook on c2. 1.Kd2? avoids the check, but it does not protect the pawn.$s$,
   '[{"san":"Rc1","fen":"r2qkbnr/1pp1pppb/p6p/3p4/1n1P1B2/2N2N2/PPP1PPPP/2RQKB1R b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'f3', '3r1rk1/1b3ppp/p1qppn2/1p6/4P3/1BP1Q3/PP3PPP/2NR1RK1 w - - 0 1', 'w',
   '', $s$Three minor and major pieces are attacking e4 for Black; f3 is the best way to protect it — any other move loses material. 1.e5?? saves the pawn, but it is a big blunder since it allows 1...Qxg2#.$s$,
   '[{"san":"f3","fen":"3r1rk1/1b3ppp/p1qppn2/1p6/4P3/1BP1QP2/PP4PP/2NR1RK1 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 2, 'Kd8', 'r1b1k2r/pppp1ppp/4n3/3N4/5P1q/2PQ4/P1P2PPP/R1B1KB1R b - - 0 1', 'b',
   '', $s$Protects the c7 pawn and avoids the fork. A move like 1...a6 allows 2.Nxc7+, which loses a pawn and the a8-rook.$s$,
   '[{"san":"Kd8","fen":"r1bk3r/pppp1ppp/4n3/3N4/5P1q/2PQ4/P1P2PPP/R1B1KB1R w - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 3, 'O-O', 'r2k3r/pp3ppp/1qp1bn2/2b1p3/4P3/1P1P2PP/P2BNPB1/R3K2R w KQ - 0 1', 'w',
   '', $s$Protects the pawn while putting the rook in a better position. (Coach's notes said "0-0-0", but the screenshot clearly shows the kingside castle.)$s$,
   '[{"san":"O-O","fen":"r2k3r/pp3ppp/1qp1bn2/2b1p3/4P3/1P1P2PP/P2BNPB1/R4RK1 b - - 0 1"}]'::jsonb,
   NULL, NULL);

  -- ===========================================================================
  -- Lesson Plan 2
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 2, '', ARRAY[]::text[])
  RETURNING id INTO v_lp_id;

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Defend and Protect', 0)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'Na3', 'r2qkb1r/1p3ppp/3p4/pP1Ppb2/P7/1Q2PN2/5PPP/RN2KB1R w KQkq - 0 1', 'w',
   '', $s$Protects the c2 square from the bishop and knight. The knight was threatening a fork.$s$,
   '[{"san":"Na3","fen":"r2qkb1r/1p3ppp/3p4/pP1Ppb2/P7/NQ2PN2/5PPP/R3KB1R b KQkq - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'a3', '6k1/5ppp/8/8/BN1rp3/7P/P4PP1/6K1 w - - 0 1', 'w',
   '', $s$White's pieces are lined up on the 4th rank. This pawn move protects both unprotected pieces.$s$,
   '[{"san":"a3","fen":"6k1/5ppp/8/8/BN1rp3/P6P/5PP1/6K1 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 2, 'Bb2', 'r1bqk2r/ppp2ppp/2n1pn2/3p4/1b6/1PNP1NP1/P1P1PP1P/R1BQK2R w KQkq - 0 1', 'w',
   '', $s$Protects the knight on c3, which is pinned. d4 is coming.$s$,
   '[{"san":"Bb2","fen":"r1bqk2r/ppp2ppp/2n1pn2/3p4/1b6/1PNP1NP1/PBP1PP1P/R2QK2R b KQkq - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 3, 'Be3', 'q1rr4/3p2k1/pb1Pppb1/1p2n1p1/1P1N4/P4P2/B1PB2PP/2RQR1K1 w - - 0 1', 'w',
   '', $s$Protects the knight on d4, which is pinned.$s$,
   '[{"san":"Be3","fen":"q1rr4/3p2k1/pb1Pppb1/1p2n1p1/1P1N4/P3BP2/B1P2PP1/2RQR1K1 b - - 0 1"}]'::jsonb,
   NULL, NULL);

  -- ===========================================================================
  -- Lesson Plan 3
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 3, '', ARRAY[]::text[])
  RETURNING id INTO v_lp_id;

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Defend and Protect', 0)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'e4', 'q4rk1/p4pp1/7p/1rp3b1/2B5/P2P2Pb/4P2P/R1BQR1K1 w - - 0 1', 'w',
   '', $s$Blocks checkmate on g2.$s$,
   '[{"san":"e4","fen":"q4rk1/p4pp1/7p/1rp3b1/2B1P3/P2P2Pb/7P/R1BQR1K1 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'Bd3', '4rbk1/R6p/3p1ppn/2pP4/1p2B3/pP3N1P/P1PP2P1/4K3 w - - 0 1', 'w',
   '', $s$f5 was threatening to trap the bishop if White wasn't careful.$s$,
   '[{"san":"Bd3","fen":"4rbk1/R6p/3p1ppn/2pP4/1p6/pP1B1N1P/P1PP2P1/4K3 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 2, 'Bc5', '3r2k1/B1pb1pp1/5b1p/3p4/8/N2B4/r4PPP/1R1R2K1 w - - 0 1', 'w',
   '', $s$The knight on a3 is hanging. Moving the knight would hang the bishop on a7, so the bishop relocates to a safe square while attacking the a8-rook.$s$,
   '[{"san":"Bc5","fen":"3r2k1/2pb1pp1/5b1p/2Bp4/8/N2B4/r4PPP/1R1R2K1 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 3, 'Re1+', 'r3k2r/2pq1ppp/bpN2b2/p7/P1Pp4/1Q1P4/1P3PPP/R1B2RK1 w - - 0 1', 'w',
   '', $s$The knight on c6 is stranded. Re1 gains a tempo (this rook move gives check) while setting up a safer square for the knight.$s$,
   '[{"san":"Re1+","fen":"r3k2r/2pq1ppp/bpN2b2/p7/P1Pp4/1Q1P4/1P3PPP/R1B1R1K1 b - - 0 1"}]'::jsonb,
   NULL, NULL);
  -- Puzzle "Qxe2" skipped — no image attached in the source note.

  -- ===========================================================================
  -- Lesson Plan 4
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 4, '', ARRAY[]::text[])
  RETURNING id INTO v_lp_id;

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Defend and Protect', 0)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'g8=N+', '8/6PP/5k1K/8/8/8/1r6/8 w - - 0 1', 'w',
   '', $s$This is the only move that prevents checkmate. Promoting to a queen loses on the spot: 1.g8=Q Rh2#. Stopping the mate by moving the king also loses: 1.Kh5 Kxg7. Promoting to a knight is the only way to avoid defeat.$s$,
   '[{"san":"g8=N+","fen":"6N1/7P/5k1K/8/8/8/1r6/8 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'h4', '3q2k1/p2r1pP1/5n1p/1Ppp4/P3pB2/2P1P1P1/3Q1PKP/3R4 w - - 0 1', 'w',
   '', $s$Black is threatening to play ...g5, trapping the bishop.$s$,
   '[{"san":"h4","fen":"3q2k1/p2r1pP1/5n1p/1Ppp4/P3pB1P/2P1P1P1/3Q1PK1/3R4 b - - 0 1"}]'::jsonb,
   NULL, NULL);

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Detect the Weakness', 1)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'Kh1', 'r3r1k1/ppp2pp1/2p1bbqp/4p3/4P3/P1NP1N1P/1PP2PP1/R2Q1RK1 w - - 0 1', 'w',
   '', $s$The bishop on e6 is threatening to take the h3 pawn; g2 cannot take back because the king would put itself in check.$s$,
   '[{"san":"Kh1","fen":"r3r1k1/ppp2pp1/2p1bbqp/4p3/4P3/P1NP1N1P/1PP2PP1/R2Q1R1K b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'Bxf6', '3qk2r/pbr2pbp/1pnp1Np1/2p1p3/2P5/2NP1NP1/PPQ1PPBP/R4RK1 b - - 0 1', 'b',
   'White just took on f6. How should Black recapture?', $s$White is planning to play Nd5, forking a rook and the bishop on f6. If Black recaptures with the queen instead, White forks the rook and queen instead of the rook and bishop.$s$,
   '[{"san":"Bxf6","fen":"3qk2r/pbr2p1p/1pnp1bp1/2p1p3/2P5/2NP1NP1/PPQ1PPBP/R4RK1 w - - 0 1"}]'::jsonb,
   NULL, NULL);

  -- ===========================================================================
  -- Lesson Plan 5
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 5, '', ARRAY[]::text[])
  RETURNING id INTO v_lp_id;

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Detect the Weakness', 0)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'Ne1', '6k1/rb2qppp/p1pb4/1p2p3/2P1p3/P7/P1QPBPPP/3NRK2 w - - 0 1', 'w',
   '', $s$There are no moves to save the knight except Ne1. If Nd4, Black plays Qe5, threatening mate and forcing g3, losing the knight.$s$,
   '[{"san":"Ne1","fen":"6k1/rb2qppp/p1pb4/1p2p3/2P1p3/P7/P1QPBPPP/4NRK1 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'Ke7', '8/PP4pp/2pk4/7n/1n1rN3/1B3p1P/PP2Kp2/6R1 b - - 0 1', 'b',
   'White just played 1.Ne4+. What should Black do?', $s$Rxe4+? loses the exchange after Ke5/Kf5, forking the knight and the king. Ke7 doesn't lose material.$s$,
   '[{"san":"Ke7","fen":"8/PP2k1pp/2p5/7n/1n1rN3/1B3p1P/PP2Kp2/6R1 w - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 2, 'fxe3', 'r4rk1/p4ppp/3p4/2p1p3/2PnP2q/2NQn2P/PP3PP1/R4RK1 w - - 0 1', 'w',
   '', $s$Qxe3? loses the exchange, since Black plays Nc2, forking the rook and queen.$s$,
   '[{"san":"fxe3","fen":"r4rk1/p4ppp/3p4/2p1p3/2PnP2q/2NQP2P/PP4P1/R4RK1 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 3, 'Rxb5', '4qbk1/1p3ppp/3p4/pr6/8/8/P4PPP/1R1QR1K1 w - - 0 1', 'w',
   '', $s$Qa4? looks like a good move, pinning the b5-rook, but the b1-rook is not pinned. After Black takes Qa4, White cannot take the queen on e8 because Black has checkmate with Rxe1.$s$,
   '[{"san":"Rxb5","fen":"4qbk1/1p3ppp/3p4/pR6/8/8/P4PPP/3QR1K1 b - - 0 1"}]'::jsonb,
   NULL, NULL);

  -- ===========================================================================
  -- Lesson Plan 6
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 6, '', ARRAY[]::text[])
  RETURNING id INTO v_lp_id;

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Detect the Weakness', 0)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'h3', '4r1k1/ppp2pp1/2n4p/4ppp1/8/5NB1/PP2PP1P/5RK1 w - - 0 1', 'w',
   '', $s$Black is threatening f4, trapping the g3-bishop. Taking on e5 is not good: after 1.Bxe5? Nxe5 Black has the piece back with an extra pawn, and White cannot pin the knight with 2.Re1? because of 2...Nxf3+, losing the rook too.$s$,
   '[{"san":"h3","fen":"4r1k1/ppp2pp1/2n4p/4ppp1/8/5NBP/PP2PP2/5RK1 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'Be6+', '2kr3r/ppp2pp1/2n2q1p/2p1p3/2B1P3/P4N1P/1PP1PPP1/R3K2R w KQ - 0 1', 'w',
   'Is 1.Bxe6 a good move, or is it better to play 1.O-O to secure the king?', $s$Other moves are also playable, but the main threat from Black is to take the c4-bishop, since it is not protected. 1.O-O? Bxc4 and White cannot take back on c4 since the d-pawn is pinned.$s$,
   '[{"san":"Be6+","fen":"2kr3r/ppp2pp1/2n1Bq1p/2p1p3/4P3/P4N1P/1PP1PPP1/R3K2R b KQ - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 2, 'Nb1', 'r2qkb1r/6pp/p1nppp2/3b4/1p1NP3/P1N5/PP3PPP/3QK3 w K - 0 1', 'w',
   '', $s$The c3-knight is under attack, but there is only one good way to save it. 1.Na4? loses a piece after 1...Nxd4 2.Qxd4 Bxa4, since the c6-knight was in the way of the light-squared bishop. 1.Nxc6?! is an intermediate move that isn't losing, but it isn't good either. Only 1.Nb1 does not lose material, since now the light-squared bishop is not attacking the e4-pawn.$s$,
   '[{"san":"Nb1","fen":"r2qkb1r/6pp/p1nppp2/3b4/1p1NP3/P7/PP3PPP/1N1QK3 b K - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 3, 'Nd4', '8/3k2pp/p1N2p2/P7/1P2p3/3bP1P1/5K1P/8 w - - 0 1', 'w',
   '', $s$Nd4 is the only move to save the knight and keep the game going. 1.Na7? gets the knight trapped after ...Kc7 and ...Kb7 next, and the same happens after 1.Nb8+ Kc7.$s$,
   '[{"san":"Nd4","fen":"8/3k2pp/p4p2/P7/1P1Np3/3bP1P1/5K1P/8 b - - 0 1"}]'::jsonb,
   NULL, NULL);

  -- ===========================================================================
  -- Lesson Plan 7
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 7, '', ARRAY[]::text[])
  RETURNING id INTO v_lp_id;

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Detect the Weakness', 0)
  RETURNING id INTO v_sec_id;

  -- Puzzle "Be3" (#11 in the coach's notes) skipped — the attached image is a
  -- duplicate of the "dxc4" puzzle's screenshot (source data-entry error).

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'dxc4', 'r1bq1rk1/ppp2pp1/4pn1p/b2p4/1PPP4/P2BPN2/2QB1PPP/R4RK1 b - - 0 1', 'b',
   '', $s$With this move, both bishops are under attack. If 1...Bb6 2.c5 the dark-squared bishop is trapped and White will be up a piece — ...dxc4 is no longer possible because the c4-pawn is now on c5. 1...Bxb4 also loses a piece: 2.axb4.$s$,
   '[{"san":"dxc4","fen":"r1bq1rk1/ppp2pp1/4pn1p/b7/1PpP4/P2BPN2/2QB1PPP/R4RK1 w - - 0 1"},
     {"san":"Bxc4","fen":"r1bq1rk1/ppp2pp1/4pn1p/b7/1PBP4/P3PN2/2QB1PPP/R4RK1 b - - 0 1"},
     {"san":"Bb6","fen":"r1bq1rk1/ppp2pp1/1b2pn1p/8/1PBP4/P3PN2/2QB1PPP/R4RK1 w - - 0 1","comment":"Now the bishop is safe on b6 because the c-pawn has disappeared."}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'exd4', 'r4rk1/pppq1ppp/2Npb3/4p3/B2PP3/5N2/PPP1QPPP/R3K2R b KQ - 0 1', 'b',
   '', $s$White's threat is 2.d5, forking the e6-bishop and the c6-knight. The c6-knight is pinned, so the only way to solve both problems is removing the d-pawn. Moving the knight isn't an option: after 1...Nb8 2.Bxd7 Black is down a queen. Moving the bishop with 1...Bg4 doesn't solve the problem either: 2.d5 and the c6-knight falls since it's still pinned. 1...Nxd4 looks tempting since both queens are attacked, but after 2.Bxd7 Nxe2 3.Bxe6 fxe6 4.Kxe2 White is a piece up.$s$,
   '[{"san":"exd4","fen":"r4rk1/pppq1ppp/2Npb3/8/B2pP3/5N2/PPP1QPPP/R3K2R w KQ - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 2, 'Kg1', '3b3k/3r1r1p/2p3p1/1qP5/3pnPP1/R2N4/1PQ3R1/2B2K2 w - - 0 1', 'w',
   'Which move is better, 1.Kg1 or 1.Ne5?', $s$White has several good moves like 1.Qa4 and 1.Rb3, but the main objective is to realize which is the biggest risk on White's position. 1.Ne5? forks both black rooks, but loses on the spot to 1...Qf1#. 1.Kg1 protects the f1-square and White can play Ne5 on the next move.$s$,
   '[{"san":"Kg1","fen":"3b3k/3r1r1p/2p3p1/1qP5/3pnPP1/R2N4/1PQ3R1/2B3K1 b - - 0 1"}]'::jsonb,
   NULL, NULL);

  -- ===========================================================================
  -- Lesson Plan 8
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 8, '', ARRAY[]::text[])
  RETURNING id INTO v_lp_id;

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Detect the Weakness', 0)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'Rf2', '4r3/2b2p2/1pp4k/p4p2/P2P1P1P/1BP3P1/4R2r/3R1K2 w - - 0 1', 'w',
   'Black is preparing ...Ree2. Which move is better to stop it, Re1 or Rf2?', $s$Rf2 forces the trade of a pair of rooks, releasing the pressure on the second rank. After 1...Rh1+ 2.Kg2 the d1-rook is protected by the bishop. 1.Re1? Rh1+ and White is losing the rook, since Black is attacking e1 with two pieces.$s$,
   '[{"san":"Rf2","fen":"4r3/2b2p2/1pp4k/p4p2/P2P1P1P/1BP3P1/5R1r/3R1K2 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'Ra2', '1r3r2/6pp/p2p1n1p/2p4p/1p1nP3/PP1P3N/5PPP/R1B1R1K1 w - - 0 1', 'w',
   '', $s$Black is threatening ...Nxc2, not only taking a pawn but forking both rooks. Moving a rook away doesn't work: 1.Rf1 Nxc2 wins a pawn for no compensation. The only way to defend c2 is the ugly 1.Ra2, placing the rook on a passive square, but it protects the weak point.$s$,
   '[{"san":"Ra2","fen":"1r3r2/6pp/p2p1n1p/2p4p/1p1nP3/PP1P3N/R4PPP/2B1R1K1 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 2, 'Qxe4', 'r4rk1/pp4pp/2pq1p2/3n4/4p3/2PQ1PP1/PPP2PK1/R1B2R2 w - - 0 1', 'w',
   'The d5-knight is pinned due to the position of the black queen. Can White play 1.c4 to attack the knight, or is it better to take the e4-pawn?', $s$1.c4? is tempting, but it backfires spectacularly: Black has 1...Nf4+, checking the king and taking advantage of White's previous move, since now the white queen is underprotected and White is losing after 2.gxf4 Qxd4. Taking the e4-pawn is the best move.$s$,
   '[{"san":"Qxe4","fen":"r4rk1/pp4pp/2pq1p2/3n4/4Q3/2P2PP1/PPP2PK1/R1B2R2 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 3, 'd3', 'rn1qr3/pp3ppp/3p1n2/2b1p3/2B1P1b1/P1P2N2/1PPP1PPP/R1QR2K1 w - - 0 1', 'w',
   'Which move is better, 1.d3 or 1.d4?', $s$White cannot play 1.d4 since the center is too feeble: 1...exd4 2.cxd4 Rxe4 and Black wins a pawn, since White cannot take the c5-bishop while the white queen is under attack. 1.d3 is the solid alternative — not the only move, but it helps solidify White's center.$s$,
   '[{"san":"d3","fen":"rn1qr3/pp3ppp/3p1n2/2b1p3/2B1P1b1/P1PP1N2/1PP2PPP/R1QR2K1 b - - 0 1"}]'::jsonb,
   NULL, NULL);

  -- ===========================================================================
  -- Lesson Plan 9
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 9, '', ARRAY[]::text[])
  RETURNING id INTO v_lp_id;

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Detect the Weakness', 0)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'Re6', '6k1/2Q2ppp/1r3n2/4p2q/8/6P1/1PP2P1P/5RK1 w - - 0 1', 'w',
   '', $s$White is attacking the b6-rook, but is also threatening mate on the back rank. Threatening mate in 1 with 1...Ng4? backfires due to 2.Qc8# (or 2.Qd8#). Re6 is the only move that both protects the rook and stops the back-rank mate.$s$,
   '[{"san":"Re6","fen":"6k1/2Q2ppp/4rn2/4p2q/8/6P1/1PP2P1P/5RK1 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'Ndf3', '1k1nr2r/ppp1b3/b5p1/3p2N1/3P2P1/2P1B3/PP1N1PP1/3RK2R w K - 0 1', 'w',
   '', $s$Black is threatening the g5-knight. It may not look it in the current position, but White has several pins that can make life very difficult. For instance, after 1.Nb3? Bxg5 White has lost a piece, since the e3-bishop is pinned (the king is on the same file as the rook), and 2.hxg5 isn't possible because it loses the h1-rook to 2...Rxh1+. Ndf3 protects the other knight, and the king can escape through the d2-square.$s$,
   '[{"san":"Ndf3","fen":"1k1nr2r/ppp1b3/b5p1/3p2N1/3P2P1/2P1BN2/PP3PP1/3RK2R b K - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 2, 'Bd5', 'rn3r1k/p2qbppp/3p4/1pp4b/2BBP3/3Q1N1P/PPP2PP1/R4RK1 w - - 0 1', 'w',
   '', $s$Black is attacking the d4-bishop, but retreating it loses the other bishop after 1.Bc3 c4. Bxc5? doesn't work since the black queen is protected by the knight: 1...dxc5 2.Qxd7 Nxd7. Bd5 puts the light-squared bishop on a safe square while attacking the rook. If Black saves the rook with 1...Nc6, White retreats with 2.Bc3 and now c4 doesn't win a piece.$s$,
   '[{"san":"Bd5","fen":"rn3r1k/p2qbppp/3p4/1ppB3b/3BP3/3Q1N1P/PPP2PP1/R4RK1 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 3, 'Kf1', '4r1k1/ppp3pp/3p1b2/8/8/8/PPPP1PPP/R1B1K3 w - - 0 1', 'w',
   '', $s$Black is threatening checkmate on the first rank, so White cannot play any developing move without losing. Saving the mating threat with a move like 1.g3, or any other kingside pawn move, isn't enough since Black activates the rook with 1...Re1+ and White's back-rank pieces are tied up. The best move is 1.Kf1, stopping the checkmate while also stopping invasions along the first rank.$s$,
   '[{"san":"Kf1","fen":"4r1k1/ppp3pp/3p1b2/8/8/8/PPPP1PPP/R1B2K2 b - - 0 1"}]'::jsonb,
   NULL, NULL);

  -- ===========================================================================
  -- Lesson Plan 10
  -- ===========================================================================
  INSERT INTO lesson_plans (student_id, number, title, agenda)
  VALUES (v_student_id, 10, '', ARRAY[]::text[])
  RETURNING id INTO v_lp_id;

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Detect the Weakness', 0)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'Rf8', 'r6k/4q2p/2pp1ppP/1pb3B1/4p1bn/1BQP4/PPP2PP1/5R1K b - - 0 1', 'b',
   '', $s$After protecting the pawn with the rook, White cannot add pressure over f6, and after 2.Bxh4 b4 White has to retreat and Black is still up material (a pawn instead of a piece). White is hitting the h4-knight, but that's not the biggest threat — Bxf6 is more dangerous since it not only threatens to win the queen but delivers mate. So saving the queen isn't good: 1...Qf8? 2.Bxf6+ Qxf6 3.Qxf6#. Rf8 loses the knight but saves the game, preventing checkmate while Black stays up material.$s$,
   '[{"san":"Rf8","fen":"5r1k/4q2p/2pp1ppP/1pb3B1/4p1bn/1BQP4/PPP2PP1/5R1K w - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'g4', 'r1b5/p4kp1/2p2q1p/1p2p3/3nQ3/1P5P/P1PP1PP1/R1B1KR2 w - - 0 1', 'w',
   '', $s$Black is threatening ...Bf5, attacking the queen and also the c2-pawn with two pieces. Only 1.g4 stops ...Bf5 for good, leaving White with a fine position since Black has no way to exploit White's weakness. 1.Kd1?, defending c2 in advance, does not stop 1...Bf5 2.Qe3 Nxc2, forking the rook and the queen.$s$,
   '[{"san":"g4","fen":"r1b5/p4kp1/2p2q1p/1p2p3/3nQ1P1/1P5P/P1PP1P2/R1B1KR2 b - - 0 1"}]'::jsonb,
   NULL, NULL);

  INSERT INTO lesson_sections (lesson_plan_id, title, sort_order)
  VALUES (v_lp_id, 'Can I Take It?', 1)
  RETURNING id INTO v_sec_id;

  INSERT INTO puzzles (section_id, sort_order, label, starting_fen, side_to_move, quiz_prompt, summary, solution, reference_url, reference_label)
  VALUES
  (v_sec_id, 0, 'h4', '6k1/3p2p1/r4p1p/1b1P1p2/Pp4P1/1P3BB1/2P2PPP/6K1 w - - 0 1', 'w',
   '', $s$axb5? loses due to the back-rank mate: 1...Ra1+ 2.Bd1 Rxd1#. The way to prevent the back-rank mate is to push a kingside pawn. Since the f- and g-file pawns are blocked, White must push the h-pawn.$s$,
   '[{"san":"h4","fen":"6k1/3p2p1/r4p1p/1b1P1p2/Pp4PP/1P3BB1/2P2PP1/6K1 b - - 0 1"}]'::jsonb,
   NULL, NULL),

  (v_sec_id, 1, 'Nb6', 'r1bqk2r/ppp2ppp/4p3/3n4/4P3/2P1P3/P4PPP/R1BQKB1R b - - 0 1', 'b',
   '', $s$Other moves like 1...Ne7 or 1...Nf6 are also fine. The main thing to look for here is that 1...Nxc3? is a big mistake — the knight gets trapped after 2.Qc2.$s$,
   '[{"san":"Nb6","fen":"r1bqk2r/ppp2ppp/1n2p3/8/4P3/2P1P3/P4PPP/R1BQKB1R w - - 0 1"}]'::jsonb,
   NULL, NULL);

  RAISE NOTICE 'Added lesson plans 1-10 for student %', v_student_id;
END;
$migration$;
