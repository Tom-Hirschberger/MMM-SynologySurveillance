$(document).on('form_loaded', function () {

	/* thresholds are dual type.. need to surface the correct one, base on data
	   both are hidden in CSS  as we can't do this in css yet 
	   	let classes=['real','dummy'];let value=evt.target.value;let dummy = (value ==='mjpeg'?1:0);var parentElement=$(evt.target).closest('fieldset');let fs='div[class$=\"'+classes[dummy]+'\"]'; parentElement.find(fs).css('display','block');fs='div[class$=\"'+classes[(dummy?0:1)]+'\"]';parentElement.find(fs).css('display','none')}"
		// process each
	*/

	$('.m_MMM-SynologySurveillance div[class$="protocol"] option:selected').each(
	
		function(i,t){
			// get its selected option text for this threshold structure
			var selected_option_value=$(t).val(); //.text() contains the visible value from titlemap, .val() contains the enum value
																						// if no title map .text() and .val() are the same
			if(selected_option_value !== 'mjpeg')
				selected_option_value = 'real'
			else
			  selected_option_value = 'dummy'
			// look above the select to the next element that encloses select and the custom fields (fieldset)
			// this is all one clause, just split over multiple lines for clarity
			$(t).closest('fieldset')
				// find below the fieldset to find the appropriate div with the right class,
				.find('div[class$="'+selected_option_value+'"]')  // depends on the htmlClass option in the schema
					// and set its display style property to block,
				  // previously set to display:none by MMM-Config.extension.css
					.css('display','block')
		}
	)
})