--INSERT INTO User(name,username,password,gender)
--VALUES('Vyshnavi','vyshi@chociee','passvyshi','Female'),
--('Namratha','NamrathaKaramsetty','passnammu','Female'),
--('Abhigna','Abhi_reddy_Gangula','passAbhi##','Female'),
--('Akram','Akram_baig','passakbaigk','Male'),
--('Vivek','Vivek_sunny','passVivek','Male');

INSERT INTO Follower (follower_user_id, following_user_id) VALUES 
(1, 2),  -- Vyshnavi follows Namratha
(2, 3),  -- Namratha follows Abhigna
(3, 1),  -- Abhigna follows Vyshnavi
(4, 2),  -- Akram follows Namratha
(5, 4),  -- Vivek follows Akram
(1, 3),  -- Vyshnavi follows Abhigna
(2, 5),  -- Namratha follows Vivek
(3, 4);  -- Abhigna follows Akram

INSERT INTO Tweet (tweet, user_id, date_time) VALUES 
('Hello Twitter! First tweet ', 1, '2025-03-17 09:00:00'),
('Enjoying a cup of coffee ', 2, '2025-03-17 10:15:00'),
('Excited to start a new project!', 3, '2025-03-17 11:30:00'),
('Late-night coding session! ', 4, '2025-03-17 23:45:00'),
('Good morning, everyone!', 5, '2025-03-18 07:00:00');

INSERT INTO Reply (tweet_id, reply, user_id, date_time) VALUES 
(1, 'Welcome to Twitter! ', 2, '2025-03-17 09:10:00'),
(2, 'I love coffee too! ', 3, '2025-03-17 10:20:00'),
(3, 'What’s your project about?', 4, '2025-03-17 11:45:00'),
(4, 'Same here! Night owls unite ', 5, '2025-03-17 23:50:00'),
(5, 'Good morning! Have a great day ', 1, '2025-03-18 07:10:00');

INSERT INTO Like (tweet_id, user_id, date_time) VALUES 
(1, 3, '2025-03-17 09:05:00'),  -- Abhigna likes Vyshnavi's tweet
(2, 1, '2025-03-17 10:30:00'),  -- Vyshnavi likes Namratha's tweet
(3, 5, '2025-03-17 12:00:00'),  -- Vivek likes Abhigna's tweet
(4, 2, '2025-03-18 00:10:00'),  -- Namratha likes Akram's tweet
(5, 4, '2025-03-18 07:15:00');  -- Akram likes Vivek's tweet


