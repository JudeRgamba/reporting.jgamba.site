<?php
require_once '../includes/admin-auth.php';

// Forward the request to Node
$method  = $_SERVER['REQUEST_METHOD'];
$nodeUrl = 'http://localhost:3006/api/users';

// Append path info for /api/users/:id
if (!empty($_SERVER['PATH_INFO'])) {
    $nodeUrl .= $_SERVER['PATH_INFO'];
}

// Append query string for ?self=
if (!empty($_SERVER['QUERY_STRING'])) {
    $nodeUrl .= '?' . $_SERVER['QUERY_STRING'];
}

$opts = [
    'http' => [
        'method'  => $method,
        'header'  => 'Content-Type: application/json',
        'content' => file_get_contents('php://input'),
        'ignore_errors' => true
    ]
];

$response = file_get_contents($nodeUrl, false, stream_context_create($opts));
$status   = $http_response_header[0] ?? 'HTTP/1.1 500';

http_response_code((int)explode(' ', $status)[1]);
header('Content-Type: application/json');
echo $response;