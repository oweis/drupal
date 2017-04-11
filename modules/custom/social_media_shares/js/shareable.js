var $j = jQuery.noConflict();
$j(document).ready(function(){

	$j('.share-button').click(function(){
		$j.ajax({ 
		     url: '/shares/'+$j(this).attr('node-id'),
		     type: 'GET',
			 success: function(d){
			 	console.log('done');
 			 }
		});

	});
});
