# How to create custom buttons

* Set button action to 'Custom'
* Set the button custom logic to modify form data:
    ```json
    form.data['locationAddress2'] = 'foo';
    form.redraw();
    ```
* To run REST APIs:
    ```json
    // Store reference to form for async operations
    const formRef = form;

    fetch('https://jsonplaceholder.typicode.com/posts')
    .then(response => response.json())
    .then(data => {
        console.log('First post:', data[0]);

        // Update form data with fetch result
        formRef.data['locationAddress2'] = data[0].title.substring(0, 50); // Use part of title
        formRef.data['county'] = 'Updated from API';

        console.log('Updated form data:', formRef.data);

        // Manually trigger redraw after async operation
        formRef.redraw();
    })
    .catch(error => console.error('Error:', error));
    ```