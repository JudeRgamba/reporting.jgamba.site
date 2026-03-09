<?php
require_once 'includes/admin-auth.php';

$method  = $_SERVER['REQUEST_METHOD'];
$nodeUrl = 'http://localhost:3006/api/users';

// Get user ID from query param instead of PATH_INFO
$userId = $_GET['id'] ?? null;
if ($userId) {
    $nodeUrl .= '/' . intval($userId);
}

// Append self param for delete
$self = $_GET['self'] ?? null;
if ($self) {
    $nodeUrl .= '?self=' . intval($self);
}

$opts = [
    'http' => [
        'method'  => $method,
        'header'  => "Content-Type: application/json\r\n",
        'content' => file_get_contents('php://input'),
        'ignore_errors' => true
    ]
];

$response = file_get_contents($nodeUrl, false, stream_context_create($opts));
$status   = $http_response_header[0] ?? 'HTTP/1.1 500';

http_response_code((int)explode(' ', $status)[1]);
header('Content-Type: application/json');
echo $response;