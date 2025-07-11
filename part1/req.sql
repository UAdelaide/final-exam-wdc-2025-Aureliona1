USE DogWalkService;
-- Holy moly, we actually got there
SELECT Users.username AS walker_username,
COUNT(WalkRatings.rating_id) AS total_ratings,
AVG(WalkRatings.rating) AS average_rating,
COUNT(WalkRequests.request_id) AS completed_walks
FROM ((Users LEFT JOIN WalkRatings ON WalkRatings.walker_id = Users.user_id)
LEFT JOIN WalkRequests ON WalkRequests.request_id = WalkRatings.request_id AND WalkRequests.status = 'completed')
WHERE Users.role = 'walker'
GROUP BY Users.username;